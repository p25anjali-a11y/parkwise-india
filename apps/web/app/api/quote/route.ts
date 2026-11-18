import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_RULES, quote, type PricingRules } from "@parkwise/pricing";
import { eventUpliftFor, signalsFor, withEventUplift } from "../../../lib/quote-inputs";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";

const q = z.object({
  lotId: z.string().uuid(),
  arrivalInMin: z.coerce.number().int().min(0).max(7 * 24 * 60).default(0),
  durationMin: z.coerce.number().int().min(15).max(24 * 60).default(60),
});

export async function GET(req: Request) {
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { lotId, arrivalInMin, durationMin } = p.data;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,city").eq("id", lotId).eq("status", "approved").maybeSingle();
  if (!lot) return NextResponse.json({ error: "not found" }, { status: 404 });

  const arrival = new Date(Date.now() + arrivalInMin * 60_000);
  const [{ data: zone }, { data: live }, { data: rr }, { data: events }, { data: sig }] = await Promise.all([
    sb.from("zones").select("id").eq("lot_id", lotId).limit(1).maybeSingle(),
    sb.from("lot_live_state").select("occupied,capacity").eq("lot_id", lotId).maybeSingle(),
    sb.from("price_rules").select("rules").eq("lot_id", lotId).eq("active", true).is("zone_id", null).maybeSingle(),
    sb.from("events").select("starts_at,ends_at,impact").eq("lot_id", lotId),
    sb.from("demand_signals").select("kind,value,valid_at").eq("city", lot.city),
  ]);
  if (!zone) return NextResponse.json({ error: "lot has no zone" }, { status: 409 });

  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const upliftedRules = withEventUplift(rules, eventUpliftFor(events ?? [], arrival, durationMin));
  // Until the forecast service is wired (milestone 7) the occupancy input is the current count, not a forecast.
  const predicted = live && live.capacity > 0 ? live.occupied / live.capacity : 0;
  const result = quote({
    lotId,
    zoneId: zone.id,
    rules: upliftedRules,
    predictedOccupancy: predicted,
    arrivalTime: arrival,
    durationMin,
    signals: signalsFor(sig ?? [], arrival),
  });

  // Persist what was shown, when the server has a service-role key. Never blocks the response.
  let saved = false;
  const admin = supabaseAdmin();
  if (admin) {
    const { data: { user } } = await sb.auth.getUser();
    const ins = await admin.from("price_quotes").insert({
      user_id: user?.id ?? null, lot_id: lotId, zone_id: zone.id, arrival_at: arrival.toISOString(), duration_min: durationMin,
      predicted_occupancy: result.predictedOccupancy, multiplier: result.multiplier, rate_per_hour_paise: result.ratePerHour,
      total_paise: result.total, breakdown: result.breakdown, model_version: "current-occupancy-v0",
    });
    saved = !ins.error;
  }
  return NextResponse.json({ ...result, occupancySource: "current count (forecast not yet wired)", saved });
}
