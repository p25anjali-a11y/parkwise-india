import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { z } from "zod";
import { describeForecast, nearestForecast } from "../../../lib/availability";
import { confidenceLabel } from "@parkwise/forecast";
import { liveWeatherRows, rainProbAt } from "../../../lib/live-signals";
import { eventUpliftFor } from "../../../lib/quote-inputs";
import { SIMULATION_MODEL, simulatedOccupancy } from "../../../lib/simulated-occupancy";
import { supabaseServer } from "../../../lib/supabase/server";

const q = z.object({ lotId: z.string().uuid(), arrivalInMin: z.coerce.number().int().min(0).max(24 * 60).default(0) });

export async function GET(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "avail", 60);
  if (tooMany) return tooMany;
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const target = new Date(Date.now() + p.data.arrivalInMin * 60_000);
  const { data: lot } = await sb.from("lots").select("id,city,category,is_synthetic").eq("id", p.data.lotId).eq("status", "approved").maybeSingle();
  if (!lot) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (lot.is_synthetic) {
    // Simulated lot: invented counts, driven by the real clock, live rain probability and real event windows.
    const [{ data: zones }, { data: events }, wx] = await Promise.all([
      sb.from("zones").select("capacity,slot_types!inner(code)").eq("lot_id", lot.id).eq("slot_types.code", "car"),
      sb.from("events").select("starts_at,ends_at,impact").eq("lot_id", lot.id),
      liveWeatherRows(lot.city),
    ]);
    const capacity = (zones ?? []).reduce((n, z) => n + z.capacity, 0);
    if (!capacity) return NextResponse.json({ available: false, reason: "This place has no bays listed." });
    const f = simulatedOccupancy({ lotId: lot.id, category: lot.category, at: target, rainProb: rainProbAt(wx, target), eventImpact: eventUpliftFor(events ?? [], target, 60) / 0.25 });
    const p50 = Math.round(f * capacity);
    const spread = Math.round(0.08 * capacity);
    const p10 = Math.max(0, p50 - spread);
    const p90 = Math.min(capacity, p50 + spread);
    const pFull = f >= 0.97 ? 0.8 : f >= 0.9 ? 0.3 : 0.02;
    return NextResponse.json({
      available: true, simulated: true, arrivalAt: target.toISOString(), capacity,
      label: confidenceLabel(p10, pFull, capacity),
      freeBays: { likely: capacity - p50, pessimistic: capacity - p90, optimistic: capacity - p10 },
      pFull, stale: false, coldStart: false, modelVersion: SIMULATION_MODEL,
    });
  }
  const lo = new Date(target.getTime() - 20 * 60_000).toISOString();
  const hi = new Date(target.getTime() + 20 * 60_000).toISOString();
  const [{ data: rows }, { data: live }] = await Promise.all([
    sb.from("forecasts").select("target_time,p10,p50,p90,p_full,model_version,stale,cold_start").eq("lot_id", p.data.lotId).gte("target_time", lo).lte("target_time", hi),
    sb.from("lot_live_state").select("capacity").eq("lot_id", p.data.lotId).maybeSingle(),
  ]);
  const row = nearestForecast((rows ?? []).map((r) => ({ ...r, p_full: Number(r.p_full) })), target);
  if (!row || !live) return NextResponse.json({ available: false, reason: "No forecast for this time yet; showing current count instead." });
  return NextResponse.json({ available: true, arrivalAt: target.toISOString(), capacity: live.capacity, ...describeForecast(row, live.capacity) });
}
