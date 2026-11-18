import Link from "next/link";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { chooseOccupancy } from "../../lib/occupancy-input";
import { LotMap } from "../../components/LotMap";
import { hasSupabaseEnv } from "../../lib/env";
import { availabilityNow, CITY_CENTRES, sortByDistance } from "../../lib/geo";
import { supabaseServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city: c } = await searchParams;
  const city = c && c in CITY_CENTRES ? c : "Mumbai";
  const centre = CITY_CENTRES[city]!;
  if (!hasSupabaseEnv()) return <main style={{ padding: 24 }}>Supabase is not configured for this deployment.</main>;

  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name,city,category,lat,lng").eq("city", city).eq("status", "approved");
  const ids = (lots ?? []).map((l) => l.id);
  const { data: live } = await sb.from("lot_live_state").select("lot_id,occupied,capacity,updated_at,source,is_synthetic").in("lot_id", ids);
  const { data: rules } = await sb.from("price_rules").select("lot_id,rules").in("lot_id", ids).eq("active", true).is("zone_id", null);
  const liveBy = new Map((live ?? []).map((l) => [l.lot_id, l]));
  const rulesBy = new Map((rules ?? []).map((r) => [r.lot_id, { ...DEFAULT_RULES, ...(r.rules as Partial<PricingRules>) } as PricingRules]));
  const now = new Date();

  const rows = sortByDistance(lots ?? [], centre).map((l) => {
    const s = liveBy.get(l.id);
    const occ = chooseOccupancy({ forecast: null, live: s ?? null, arrival: now, now });
    const q = quote({ lotId: l.id, zoneId: "now", rules: rulesBy.get(l.id) ?? DEFAULT_RULES, predictedOccupancy: occ.value, arrivalTime: now, durationMin: 60, inputs: [occ.input] });
    return { ...l, label: occ.value !== null && s ? availabilityNow(s.occupied, s.capacity) : "No live availability", rate: q.ratePerHour, live: occ.value !== null };
  });

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Find parking</h1>
      <nav style={{ display: "flex", gap: 12 }}>
        {Object.keys(CITY_CENTRES).map((k) => (
          <Link key={k} href={`/search?city=${k}`} style={{ fontWeight: k === city ? 700 : 400 }}>{k}</Link>
        ))}
      </nav>
      <LotMap centre={centre} lots={rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, label: r.label }))} />
      <p style={{ fontSize: 13, color: "#555" }}>
        Availability and price are for right now. A lot shows live availability only when its occupancy count is under 30 minutes old; otherwise you see its base tariff and "No live availability".
      </p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <li key={r.id} data-testid="result" style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <Link href={`/lots/${r.id}`}><strong>{r.name}</strong></Link> · {r.category} · {r.km.toFixed(1)} km from centre
            <div>{r.label} · ₹{(r.rate / 100).toFixed(0)}/hr now{r.live ? "" : " (base tariff, no fresh live data)"}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
