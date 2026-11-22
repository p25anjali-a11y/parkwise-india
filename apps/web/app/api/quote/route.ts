import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { z } from "zod";
import { DEFAULT_RULES, quote, type PricingRules } from "@parkwise/pricing";
import { nearestForecast } from "../../../lib/availability";
import { resolveOccupancy } from "../../../lib/resolve-occupancy";
import { liveTrafficRows, liveWeatherRows, rainProbAt } from "../../../lib/live-signals";
import { eventUpliftFor, signalsFor, withEventUplift } from "../../../lib/quote-inputs";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { loadRulesFor } from "../../../lib/public-rules";
import { supabaseServer } from "../../../lib/supabase/server";

const q = z.object({
  lotId: z.string().uuid(),
  arrivalInMin: z.coerce.number().int().min(0).max(7 * 24 * 60).default(0),
  durationMin: z.coerce.number().int().min(15).max(24 * 60).default(60),
});

export async function GET(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "quote", 30);
  if (tooMany) return tooMany;
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { lotId, arrivalInMin, durationMin } = p.data;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,city,category,lat,lng,is_synthetic").eq("id", lotId).eq("status", "approved").maybeSingle();
  if (!lot) return NextResponse.json({ error: "not found" }, { status: 404 });

  const arrival = new Date(Date.now() + arrivalInMin * 60_000);
  const [{ data: zone }, { data: live }, { data: rr }, { data: events }, { data: sig }, { data: fc }] = await Promise.all([
    sb.from("zones").select("id,slot_types!inner(code)").eq("lot_id", lotId).eq("slot_types.code", "car").limit(1).maybeSingle(),
    sb.from("lot_live_state").select("occupied,capacity,updated_at,source,is_synthetic").eq("lot_id", lotId).maybeSingle(),
    loadRulesFor(sb, [lotId]).then((m) => ({ data: m.has(lotId) ? { rules: m.get(lotId) } : null })),
    sb.from("events").select("starts_at,ends_at,impact").eq("lot_id", lotId),
    sb.from("demand_signals").select("kind,value,valid_at,created_at,is_mock,source").eq("city", lot.city).or(`lot_id.is.null,lot_id.eq.${lotId}`),
    sb.from("forecasts").select("target_time,p10,p50,p90,p_full,model_version,stale,cold_start,generated_at").eq("lot_id", lotId)
      .gte("target_time", new Date(arrival.getTime() - 20 * 60_000).toISOString()).lte("target_time", new Date(arrival.getTime() + 20 * 60_000).toISOString()),
  ]);
  if (!zone) return NextResponse.json({ error: "lot has no zone" }, { status: 409 });

  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const upliftedRules = withEventUplift(rules, eventUpliftFor(events ?? [], arrival, durationMin));
  // Real data only. Forecasts are built from real snapshots; a live count must be fresh; otherwise no occupancy is used.
  const fcRow = nearestForecast((fc ?? []).map((r) => ({ ...r, p_full: Number(r.p_full) })), arrival);
  // Weather and traffic are LIVE for every lot (simulated or real). Stored rows from the hourly job are merged in.
  const [wx, tr] = await Promise.all([liveWeatherRows(lot.city), liveTrafficRows({ lat: lot.lat, lng: lot.lng })]);
  const signalRows = [...wx, ...tr, ...(sig ?? [])];
  const eventUplift = eventUpliftFor(events ?? [], arrival, durationMin);
  const occ = resolveOccupancy({
    lot, forecast: fcRow, live: live ?? null, arrival,
    rainProb: rainProbAt(signalRows, arrival), eventImpact: eventUplift / 0.25,
  });
  const { signals, inputs: signalInputs } = signalsFor(signalRows, arrival);
  const inputs = [occ.input, ...signalInputs, { name: "events" as const, status: eventUplift > 0 ? ("used" as const) : ("missing" as const), source: "operator / imported events" }];
  const modelVersion = occ.modelVersion;
  const result = quote({
    lotId,
    zoneId: zone.id,
    rules: upliftedRules,
    predictedOccupancy: occ.value,
    arrivalTime: arrival,
    durationMin,
    signals,
    inputs,
  });

  // Persist what was shown, when the server has a service-role key. Never blocks the response.
  let saved = false;
  let quoteId: string | null = null;
  const admin = supabaseAdmin();
  if (admin) {
    const { data: { user } } = await sb.auth.getUser();
    const ins = await admin.from("price_quotes").insert({
      user_id: user?.id ?? null, lot_id: lotId, zone_id: zone.id, arrival_at: arrival.toISOString(), duration_min: durationMin,
      predicted_occupancy: result.predictedOccupancy, multiplier: result.multiplier, rate_per_hour_paise: result.ratePerHour,
      total_paise: result.total, breakdown: result.breakdown, model_version: modelVersion, data_inputs: inputs,
    }).select("id").single();
    saved = !ins.error;
    quoteId = ins.data?.id ?? null;
  }
  return NextResponse.json({ ...result, quoteId, occupancySource: occ.input.status === "used" ? occ.input.source : "none: no fresh occupancy data, base tariff", simulated: occ.simulated, inputs, saved });
}
