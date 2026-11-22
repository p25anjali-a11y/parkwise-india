import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { resolveOccupancy } from "../../lib/resolve-occupancy";
import { liveTrafficRows, liveWeatherRows, rainProbAt } from "../../lib/live-signals";
import { signalsFor } from "../../lib/quote-inputs";
import { SearchExplorer } from "../../components/SearchExplorer";
import { hasSupabaseEnv } from "../../lib/env";
import { availabilityNow, CITY_CENTRES, sortByDistance } from "../../lib/geo";
import { supabaseServer } from "../../lib/supabase/server";
import { loadRulesFor } from "../../lib/public-rules";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city: c } = await searchParams;
  const city = c && c in CITY_CENTRES ? c : "Mumbai";
  const centre = CITY_CENTRES[city]!;
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;

  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name,city,category,lat,lng,is_synthetic").eq("city", city).eq("status", "approved");
  const ids = (lots ?? []).map((l) => l.id);
  const { data: live } = await sb.from("lot_live_state").select("lot_id,occupied,capacity,updated_at,source,is_synthetic").in("lot_id", ids);
  const rulesRaw = await loadRulesFor(sb, ids);
  const { data: evZones } = await sb.from("zones").select("lot_id,slot_types!inner(code)").in("lot_id", ids).eq("slot_types.code", "ev");
  const evSet = new Set((evZones ?? []).map((z) => z.lot_id));
  const liveBy = new Map((live ?? []).map((l) => [l.lot_id, l]));
  const rulesBy = new Map([...rulesRaw].map(([id, r]) => [id, { ...DEFAULT_RULES, ...(r as Partial<PricingRules>) } as PricingRules]));
  const now = new Date();

  const wx = await liveWeatherRows(city, now);
  const rows = await Promise.all(sortByDistance(lots ?? [], centre).map(async (l) => {
    const s = liveBy.get(l.id);
    const rows = [...wx, ...(await liveTrafficRows({ lat: l.lat, lng: l.lng }, now))];
    const occ = resolveOccupancy({ lot: l, forecast: null, live: s ?? null, arrival: now, now, rainProb: rainProbAt(rows, now) });
    const { signals, inputs } = signalsFor(rows, now, now);
    const q = quote({ lotId: l.id, zoneId: "now", rules: rulesBy.get(l.id) ?? DEFAULT_RULES, predictedOccupancy: occ.value, arrivalTime: now, durationMin: 60, signals, inputs: [occ.input, ...inputs] });
    const label = occ.value === null ? "No live availability" : availabilityNow(Math.round(occ.value * 100), 100);
    return { ...l, hasEv: evSet.has(l.id), label, rate: q.ratePerHour, live: occ.value !== null, simulated: occ.simulated, occ: occ.value };
  }));

  return (
    <SearchExplorer
      city={city}
      cities={Object.keys(CITY_CENTRES)}
      centre={centre}
      lots={rows.map((r) => ({ id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, km: r.km, rate: r.rate, label: r.label, simulated: r.simulated, hasEv: r.hasEv, occ: r.occ }))}
    />
  );
}
