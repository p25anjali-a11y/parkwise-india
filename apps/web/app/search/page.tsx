import Link from "next/link";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { resolveOccupancy } from "../../lib/resolve-occupancy";
import { liveTrafficRows, liveWeatherRows, rainProbAt } from "../../lib/live-signals";
import { signalsFor } from "../../lib/quote-inputs";
import { LotMap } from "../../components/LotMap";
import { hasSupabaseEnv } from "../../lib/env";
import { availabilityNow, CITY_CENTRES, sortByDistance } from "../../lib/geo";
import { supabaseServer } from "../../lib/supabase/server";
import { getLang } from "../../lib/lang";
import { LangSwitch } from "../../components/I18n";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ city?: string; cat?: string; sort?: string; ev?: string }> }) {
  const { t, tl } = await getLang();
  const { city: c, cat, sort, ev } = await searchParams;
  const city = c && c in CITY_CENTRES ? c : "Mumbai";
  const centre = CITY_CENTRES[city]!;
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;

  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name,city,category,lat,lng,is_synthetic").eq("city", city).eq("status", "approved");
  const ids = (lots ?? []).map((l) => l.id);
  const { data: live } = await sb.from("lot_live_state").select("lot_id,occupied,capacity,updated_at,source,is_synthetic").in("lot_id", ids);
  const { data: rules } = await sb.from("price_rules").select("lot_id,rules").in("lot_id", ids).eq("active", true).is("zone_id", null);
  const { data: evZones } = await sb.from("zones").select("lot_id,slot_types!inner(code)").in("lot_id", ids).eq("slot_types.code", "ev");
  const evSet = new Set((evZones ?? []).map((z) => z.lot_id));
  const liveBy = new Map((live ?? []).map((l) => [l.lot_id, l]));
  const rulesBy = new Map((rules ?? []).map((r) => [r.lot_id, { ...DEFAULT_RULES, ...(r.rules as Partial<PricingRules>) } as PricingRules]));
  const now = new Date();

  const wx = await liveWeatherRows(city, now);
  const rows = await Promise.all(sortByDistance(lots ?? [], centre).map(async (l) => {
    const s = liveBy.get(l.id);
    const rows = [...wx, ...(await liveTrafficRows({ lat: l.lat, lng: l.lng }, now))];
    const occ = resolveOccupancy({ lot: l, forecast: null, live: s ?? null, arrival: now, now, rainProb: rainProbAt(rows, now) });
    const { signals, inputs } = signalsFor(rows, now, now);
    const q = quote({ lotId: l.id, zoneId: "now", rules: rulesBy.get(l.id) ?? DEFAULT_RULES, predictedOccupancy: occ.value, arrivalTime: now, durationMin: 60, signals, inputs: [occ.input, ...inputs] });
    const label = occ.value === null ? "No live availability" : availabilityNow(Math.round(occ.value * 100), 100);
    return { ...l, hasEv: evSet.has(l.id), label, rate: q.ratePerHour, live: occ.value !== null, simulated: occ.simulated };
  }));

  const CATS = [["", "catAll", "✨"], ["mall", "catMall", "🛍️"], ["stadium", "catStadium", "🏟️"], ["hospital", "catHospital", "🏥"], ["other", "catOther", "✈️"]] as const;
  const shown = rows.filter((r) => (ev !== "1" || r.hasEv) && !cat || r.category === cat || (cat === "other" && !["mall", "stadium", "hospital"].includes(r.category)));
  if (sort === "cheap") shown.sort((a, b) => a.rate - b.rate);
  const cheapest = Math.min(...rows.map((r) => r.rate));
  const href = (o: { cat?: string; sort?: string; ev?: string }) => `/search?city=${city}${(o.cat ?? cat) ? `&cat=${o.cat ?? cat}` : ""}${(o.sort ?? sort) ? `&sort=${o.sort ?? sort}` : ""}${(o.ev ?? ev) === "1" ? "&ev=1" : ""}`;
  const tone = (l: string) => (l === "Nearly full" ? "red" : l === "Tight" ? "orange" : l === "Likely space" ? "green" : "grey");
  return (
    <main className="shell">
      <div className="top">
        <h1>🔎 {t("findTitle")}</h1>
        <div className="chips" style={{ marginTop: 12 }}>
          {Object.keys(CITY_CENTRES).map((k) => (
            <Link key={k} href={`/search?city=${k}`} className={k === city ? "chip on" : "chip"}>{k}</Link>
          ))}
        </div>
      </div>
      <div className="card lift" style={{ padding: 8 }}>
        <LotMap centre={centre} lots={rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, label: r.label }))} />
      </div>
      <div className="chips" style={{ margin: "4px 0 10px" }}>
        {CATS.map(([k, key, ico]) => <Link key={k} href={href({ cat: k })} className={(cat ?? "") === k ? "chip on" : "chip"}>{ico} {t(key)}</Link>)}
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        <Link href={href({ ev: ev === "1" ? "0" : "1" })} className={ev === "1" ? "chip on" : "chip"}>⚡ {t("evFilter")}</Link>
        <Link href={href({ sort: "" })} className={sort !== "cheap" ? "chip on" : "chip"}>📍 {t("sortNear")}</Link>
        <Link href={href({ sort: "cheap" })} className={sort === "cheap" ? "chip on" : "chip"}>💸 {t("sortCheap")}</Link>
      </div>
      <p className="muted">{t("simulatedNote")}</p>
      <div>
        {shown.map((r) => (
          <Link key={r.id} href={`/lots/${r.id}`} data-testid="result" className="card link">
            <div className="rowb">
              <h3 style={{ margin: 0 }}>{r.name}</h3>
              <span className="price">₹{(r.rate / 100).toFixed(0)}<small style={{ fontSize: 14 }}>{t("perHour")}</small></span>
            </div>
            <div className="muted" style={{ margin: "4px 0 8px" }}>{r.category} · {r.km.toFixed(1)} {t("nearCentre")}</div>
            <span className={`pill ${tone(r.label)}`}>{tl(r.label)}</span>{" "}
            {r.simulated && <span className="pill demo">{t("simulatedBadge")}</span>} {r.hasEv && <span className="pill orange">⚡ EV</span>} {r.rate === cheapest && <span className="pill green">💸 {t("cheaper")}</span>}
          </Link>
        ))}
      </div>
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
    </main>
  );
}
