import Link from "next/link";
import { BarChart, HourChart } from "../../../components/charts";
import { ICON } from "../../../components/icons";
import { hourlyProfile, pricingSummary, reservationSummary } from "../../../lib/analytics";
import { dailyGross } from "../../../lib/csv-export";
import { simulatedDailyGross, simulatedHourlyProfile, simulatedSummary } from "../../../lib/simulated-revenue";
import { DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { getLang } from "../../../lib/lang";
import { rupees } from "../../../lib/referral";
import { supabaseServer } from "../../../lib/supabase/server";
import { operatorScope, scopedLots } from "../../../lib/operator-scope";

export const dynamic = "force-dynamic";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ lot?: string; days?: string }> }) {
  const { t } = await getLang();
  const sp = await searchParams;
  const days = [7, 14, 30].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sb = await supabaseServer();
  const scope = await operatorScope(sb);
  if (!scope) return <main className="shell"><div className="card">Sign in with an operator account to see this page.</div></main>;
  const lots = (await scopedLots(sb, scope, "id,name,category,is_synthetic,zones(capacity)")) as Array<{ id: string; name: string; category: string; is_synthetic: boolean; zones: { capacity: number }[] | null }>;
  if (lots.length === 0) return <main className="shell"><div className="top"><h1>{t("opRevenue")}</h1></div><div className="card">{t("noLotsYet")}</div></main>;
  const lot = sp.lot && sp.lot !== "all" ? lots.find((l) => l.id === sp.lot) : undefined;
  const ids = lot ? [lot.id] : lots.map((l) => l.id);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [snaps, res, quotes] = await Promise.all([
    sb.from("capacity_snapshots").select("captured_at,occupied,capacity").in("lot_id", ids).gte("captured_at", since).order("captured_at").limit(5000),
    sb.from("reservations").select("lot_id,status,total_paise,duration_min,created_at").in("lot_id", ids).gte("created_at", since).limit(5000),
    sb.from("price_quotes").select("multiplier").in("lot_id", ids).gte("created_at", since).limit(5000),
  ]);
  const rows = res.data ?? [];
  const rs = reservationSummary(rows);
  const ps = pricingSummary((quotes.data ?? []).map((q) => ({ multiplier: Number(q.multiplier) })));
  const profile = hourlyProfile(snaps.data ?? []);
  const daily = dailyGross(rows, days);
  const avg = rs.confirmed ? rs.grossPaise / rs.confirmed : 0;
  const perLot = lots.map((l) => ({ l, s: reservationSummary(rows.filter((r) => r.lot_id === l.id)) })).filter((x) => x.s.reservations > 0).sort((a, b) => b.s.grossPaise - a.s.grossPaise);
  // Demo lots have no real bookings yet: show a clearly labelled SIMULATED estimate. Lots with real bookings never get one.
  const withBookings = new Set(rows.map((r) => r.lot_id));
  const simLots = lots.filter((l) => ids.includes(l.id) && l.is_synthetic && !withBookings.has(l.id));
  const simRules = simLots.length ? (await sb.from("price_rules").select("lot_id,rules").in("lot_id", simLots.map((l) => l.id)).eq("active", true).is("zone_id", null)).data ?? [] : [];
  const simDaily = simLots.length ? simLots.map((l) => simulatedDailyGross({ lotId: l.id, category: l.category, capacity: (l.zones ?? []).reduce((n, z) => n + z.capacity, 0), rules: { ...DEFAULT_RULES, ...((simRules.find((r) => r.lot_id === l.id)?.rules as Partial<PricingRules>) ?? {}) } as PricingRules, days })).reduce((acc, d) => acc.map((x, i) => ({ day: x.day, paise: x.paise + d[i]!.paise, bayHours: x.bayHours + d[i]!.bayHours }))) : [];
  // With no real bookings at all, the KPIs and the by-hour chart fall back to the simulation (labelled).
  const useSim = rows.length === 0 && simDaily.length > 0;
  const sim = simulatedSummary(simDaily);
  const profileShown = useSim ? simulatedHourlyProfile(simLots) : profile;
  const href = (o: { lot?: string; days?: number }) => `/operator/analytics?lot=${o.lot ?? sp.lot ?? "all"}&days=${o.days ?? days}`;
  return (
    <main className="shell">
      <div className="top rowb">
        <div><h1>{t("opRevenue")}</h1><p>{lot ? lot.name : t("allLots")} · {t("lastDays", { n: days })}</p></div>
        <a className="btn ghost" href={`/api/operator/export?lot=${lot?.id ?? "all"}&days=${days}`}>{ICON.download}&nbsp;{t("exportCsv")}</a>
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>
        <Link href={href({ lot: "all" })} className={!lot ? "chip on" : "chip"}>{t("allLots")}</Link>
        {lots.map((l) => <Link key={l.id} href={href({ lot: l.id })} className={lot?.id === l.id ? "chip on" : "chip"}>{l.name}</Link>)}
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {[7, 14, 30].map((d) => <Link key={d} href={href({ days: d })} className={d === days ? "chip on" : "chip"}>{t("lastDays", { n: d })}</Link>)}
      </div>
      <div className="kpis" data-testid="revenue-kpis">
        <div className="kpi"><div className="k">{t("kGross")}</div><div className="v">{rupees(useSim ? sim.grossPaise : rs.grossPaise)}</div><div className="s">{useSim ? t("simulatedBadge") : t("kGrossNote")}</div></div>
        <div className="kpi"><div className="k">{t("kBookings")}</div><div className="v">{useSim ? sim.bookings : rs.confirmed}</div><div className="s">{useSim ? t("simulatedBadge") : t("kOfTotal", { n: rs.reservations })}</div></div>
        <div className="kpi"><div className="k">{t("kAvg")}</div><div className="v">{rupees(useSim ? sim.avgPaise : Math.round(avg))}</div><div className="s">{useSim ? t("simulatedBadge") : t("kPerBooking")}</div></div>
        <div className="kpi"><div className="k">{t("kConv")}</div><div className="v">{rs.conversionPct ?? "—"}{rs.conversionPct !== null ? "%" : ""}</div><div className="s">{t("kLost", { n: rs.cancelledOrExpired })}</div></div>
      </div>
      <div className="card"><h2>{t("dailyGross")}</h2><BarChart data={(useSim ? simDaily : daily).map((d) => ({ label: d.day.slice(5), value: Math.round(d.paise / 100) }))} label={t("dailyGross")} format={(n) => `₹${n.toLocaleString("en-IN")}`} /></div>
      {simDaily.length > 0 && (
        <div className="card" data-testid="sim-revenue"><h2>{t("simRevenue")} <span className="pill demo">{t("simulatedBadge")}</span></h2>
          <BarChart data={simDaily.map((d) => ({ label: d.day.slice(5), value: Math.round(d.paise / 100) }))} label={t("simRevenue")} format={(n) => `₹${n.toLocaleString("en-IN")}`} />
          <p className="muted" style={{ marginBottom: 0 }}>{t("simRevenueNote")}</p></div>
      )}
      <div className="grid2">
        <div className="card"><h2>{t("occByHour")}</h2><HourChart profile={profileShown} /></div>
        <div className="card">
          <h2>{t("pricingTitle")}</h2>
          <div className="rowb"><span className="muted">{t("quotesCount")}</span><strong>{ps.count}</strong></div>
          <div className="rowb"><span className="muted">{t("meanMult")}</span><strong>{ps.meanMultiplier ?? "—"}</strong></div>
          <div className="rowb"><span className="muted">{t("aboveStd")}</span><strong>{ps.peakSharePct ?? "—"}{ps.peakSharePct !== null ? "%" : ""}</strong></div>
        </div>
      </div>
      {!lot && perLot.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>{t("perLot")}</h2>
          <div className="tblwrap"><table className="tbl">
            <thead><tr><th>{t("lotCol")}</th><th className="r">{t("kBookings")}</th><th className="r">{t("kConv")}</th><th className="r">{t("kGross")}</th></tr></thead>
            <tbody>{perLot.map(({ l, s }) => <tr key={l.id}><td><Link href={`/operator/lots/${l.id}`}>{l.name}</Link></td><td className="r">{s.confirmed}</td><td className="r">{s.conversionPct ?? "—"}{s.conversionPct !== null ? "%" : ""}</td><td className="r">{rupees(s.grossPaise)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
      <p className="muted">{t("grossFootnote")}</p>
    </main>
  );
}
