import Link from "next/link";
import { BarChart, HourChart } from "../../../components/charts";
import { ICON } from "../../../components/icons";
import { hourlyProfile, pricingSummary, reservationSummary } from "../../../lib/analytics";
import { dailyGross } from "../../../lib/csv-export";
import { getLang } from "../../../lib/lang";
import { rupees } from "../../../lib/referral";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ lot?: string; days?: string }> }) {
  const { t } = await getLang();
  const sp = await searchParams;
  const days = [7, 14, 30].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name").order("name");
  if (!lots || lots.length === 0) return <main className="shell"><div className="top"><h1>{t("opRevenue")}</h1></div><div className="card">{t("noLotsYet")}</div></main>;
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
        <div className="kpi"><div className="k">{t("kGross")}</div><div className="v">{rupees(rs.grossPaise)}</div><div className="s">{t("kGrossNote")}</div></div>
        <div className="kpi"><div className="k">{t("kBookings")}</div><div className="v">{rs.confirmed}</div><div className="s">{t("kOfTotal", { n: rs.reservations })}</div></div>
        <div className="kpi"><div className="k">{t("kAvg")}</div><div className="v">{rupees(Math.round(avg))}</div><div className="s">{t("kPerBooking")}</div></div>
        <div className="kpi"><div className="k">{t("kConv")}</div><div className="v">{rs.conversionPct ?? "—"}{rs.conversionPct !== null ? "%" : ""}</div><div className="s">{t("kLost", { n: rs.cancelledOrExpired })}</div></div>
      </div>
      <div className="card"><h2>{t("dailyGross")}</h2><BarChart data={daily.map((d) => ({ label: d.day.slice(5), value: Math.round(d.paise / 100) }))} label={t("dailyGross")} format={(n) => `₹${n.toLocaleString("en-IN")}`} /></div>
      <div className="grid2">
        <div className="card"><h2>{t("occByHour")}</h2><HourChart profile={profile} /></div>
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
