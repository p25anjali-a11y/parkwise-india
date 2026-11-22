import Link from "next/link";
import { computeAlerts } from "../../lib/alerts";
import { LiveLots, type LotRow, type Live } from "../../components/LiveOccupancy";
import { hasSupabaseEnv } from "../../lib/env";
import { loadSeries } from "../../lib/lot-series";
import { reservationSummary } from "../../lib/analytics";
import { rupees } from "../../lib/referral";
import { forecastRevenue } from "../../lib/revenue-forecast";
import { ValetQueue, type ValetRow } from "../../components/ValetQueue";
import { getLang } from "../../lib/lang";
import { supabaseServer } from "../../lib/supabase/server";
import { operatorScope, scopedLots } from "../../lib/operator-scope";

export const dynamic = "force-dynamic";

export default async function Operator() {
  if (!hasSupabaseEnv()) return <main style={{ padding: 24 }}>Supabase is not configured for this deployment.</main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const scope = await operatorScope(sb);
  if (!scope) return <main className="shell"><div className="card">Sign in with an operator account to see this page.</div></main>;
  const lots = (await scopedLots(sb, scope, "id,name,city,status,category,last_feed_at")) as Array<{ id: string; name: string; city: string; status: string; category: string; last_feed_at: string | null }>;
  const myIds = lots.map((l) => l.id);
  const none = myIds.length === 0;
  const { data: live } = none ? { data: [] } : await sb.from("lot_live_state").select("lot_id,occupied,capacity,updated_at,is_synthetic").in("lot_id", myIds);
  const byLot = new Map((live ?? []).map((l) => [l.lot_id, l as Live]));
  const in2h = new Date(Date.now() + 2 * 3600_000).toISOString();
  const { data: fc } = none ? { data: [] } : await sb.from("forecasts").select("lot_id,p_full").in("lot_id", myIds).gte("target_time", new Date().toISOString()).lte("target_time", in2h);
  const maxFull = new Map<string, number>();
  for (const f of fc ?? []) maxFull.set(f.lot_id, Math.max(maxFull.get(f.lot_id) ?? 0, Number(f.p_full)));
  const feedBy = new Map(lots.map((l) => [l.id, l.last_feed_at]));
  const alerts = computeAlerts(
    (lots ?? []).filter((l) => l.status === "approved").map((l) => ({
      lotId: l.id, lotName: l.name, occupied: byLot.get(l.id)?.occupied ?? null, capacity: byLot.get(l.id)?.capacity ?? null,
      lastFeedAt: feedBy.get(l.id) ?? null, maxPFullNext2h: maxFull.get(l.id) ?? null,
    })),
  );
  const { t } = await getLang();
  const forecasts = (await Promise.all((lots ?? []).filter((l) => l.status === "approved").slice(0, 12).map(async (l) => {
    const s = await loadSeries(sb, l.id, 12);
    if (!s || s.capacity <= 0) return null;
    const pts = s.series.filter((p) => p.occupancy !== null).map((p) => ({ at: p.at, occupancy: p.occupancy as number, ratePerHour: p.ratePerHour }));
    return pts.length ? { name: s.name, simulated: s.simulated, ...forecastRevenue(pts, s.capacity) } : null;
  }))).filter((x): x is NonNullable<typeof x> => x !== null);
  const { data: valetData } = await sb.from("valet_requests").select("id,status,note,created_at,lots(name)").in("lot_id", myIds).neq("status", "done").order("created_at").limit(20);
  const valetRows: ValetRow[] = (valetData ?? []).map((v) => ({ id: v.id, status: v.status, note: v.note, lot: (v.lots as unknown as { name: string } | null)?.name ?? "Lot", arrival: new Date(v.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) }));
  const { data: wlAll } = await sb.from("waitlist").select("lot_id").in("lot_id", myIds);
  const waitBy = new Map<string, number>();
  for (const w of wlAll ?? []) waitBy.set(w.lot_id, (waitBy.get(w.lot_id) ?? 0) + 1);
  const rows: LotRow[] = (lots ?? []).map((l) => ({ ...l, live: byLot.get(l.id) ?? null }));
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: res7 }, { data: soon }] = await Promise.all([
    sb.from("reservations").select("status,total_paise,duration_min").in("lot_id", myIds).gte("created_at", since7).limit(5000),
    sb.from("reservations").select("id").in("lot_id", myIds).eq("status", "confirmed").gte("arrival_at", new Date().toISOString()).lte("arrival_at", in2h),
  ]);
  const week = reservationSummary(res7 ?? []);
  const liveRows = [...byLot.values()].filter((l) => l.capacity > 0);
  const occ = liveRows.reduce((n, l) => n + l.occupied, 0);
  const cap = liveRows.reduce((n, l) => n + l.capacity, 0);
  return (
    <main className="shell">
      <div className="top rowb">
        <div><h1>{t("opOverview")}</h1><p>{user?.email}</p></div>
        <Link href="/operator/lots/new" className="btn">{t("addLot")}</Link>
      </div>
      <div className="kpis" data-testid="op-kpis">
        <div className="kpi"><div className="k">{t("kLots")}</div><div className="v">{(lots ?? []).filter((l) => l.status === "approved").length}</div><div className="s">{t("kLotsNote", { n: (lots ?? []).length })}</div></div>
        <div className="kpi"><div className="k">{t("kInNow")}</div><div className="v">{cap ? `${occ}/${cap}` : "—"}</div><div className="s">{cap ? `${Math.round((occ / cap) * 100)}% ${t("fullNow")}` : t("noFeedYet")}</div></div>
        <div className="kpi"><div className="k">{t("kGross7")}</div><div className="v">{rupees(week.grossPaise)}</div><div className="s">{t("kBookingsN", { n: week.confirmed })}</div></div>
        <div className="kpi"><div className="k">{t("kArriving")}</div><div className="v">{(soon ?? []).length}</div><div className="s">{t("kNext2h")}</div></div>
      </div>
      {alerts.length > 0 && (
        <section aria-label="Alerts" data-testid="alerts" className="card">
          <h2>{t("alertsTitle")}</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{alerts.map((a, i) => <li key={i}><strong>{a.severity}</strong> · <Link href={`/operator/lots/${a.lotId}`}>{a.lotName}</Link>: {a.message}</li>)}</ul>
          <p className="muted" style={{ marginBottom: 0 }}>Alerts are shown here only; email and push notifications are not built yet.</p>
        </section>
      )}
      <div className="grid2" style={{ marginBottom: 12 }}>
        {forecasts.length > 0 && (
          <section aria-label="Revenue forecast" data-testid="revenue-forecast" className="card">
            <h2>{t("revenueForecast")}</h2>
            <div className="tblwrap"><table className="tbl">
              <thead><tr><th>{t("lotCol")}</th><th className="r">{t("expected")}</th></tr></thead>
              <tbody>{forecasts.map((f) => <tr key={f.name}><td>{f.name}{f.simulated ? " (demo)" : ""}</td><td className="r">{rupees(f.totalPaise)}</td></tr>)}</tbody>
            </table></div>
            <p className="muted" style={{ marginBottom: 0 }}>{t("revenueNote")}</p>
          </section>
        )}
        <section aria-label="Valet" data-testid="valet-queue" className="card"><h2>{t("valetRequestsTitle")}</h2><ValetQueue rows={valetRows} /></section>
      </div>
      {waitBy.size > 0 && <section className="card" data-testid="waitlist-counts"><h2>{t("myWaitlist")}</h2>{(lots ?? []).filter((l) => waitBy.has(l.id)).map((l) => <div className="rowb" key={l.id}><span>{l.name}</span><strong>{waitBy.get(l.id)} {t("waitingCount")}</strong></div>)}</section>}
      {rows.length === 0 ? <div className="card">{t("noLotsYet")}</div> : <LiveLots lots={rows} />}
      <form action="/auth/signout" method="post"><button type="submit" className="btn ghost block">{t("signOut")}</button></form>
    </main>
  );
}
