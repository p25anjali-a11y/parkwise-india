import { NextResponse } from "next/server";
import { z } from "zod";
import { describeForecast, nearestForecast } from "../../../lib/availability";
import { supabaseServer } from "../../../lib/supabase/server";

const q = z.object({ lotId: z.string().uuid(), arrivalInMin: z.coerce.number().int().min(0).max(24 * 60).default(0) });

export async function GET(req: Request) {
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const target = new Date(Date.now() + p.data.arrivalInMin * 60_000);
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
