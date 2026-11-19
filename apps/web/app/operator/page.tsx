import Link from "next/link";
import { computeAlerts } from "../../lib/alerts";
import { LiveLots, type LotRow, type Live } from "../../components/LiveOccupancy";
import { hasSupabaseEnv } from "../../lib/env";
import { loadSeries } from "../../lib/lot-series";
import { forecastRevenue } from "../../lib/revenue-forecast";
import { getLang } from "../../lib/lang";
import { supabaseServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Operator() {
  if (!hasSupabaseEnv()) return <main style={{ padding: 24 }}>Supabase is not configured for this deployment.</main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: lots } = await sb.from("lots").select("id,name,city,status,category").order("name");
  const { data: live } = await sb.from("lot_live_state").select("lot_id,occupied,capacity,updated_at,is_synthetic");
  const byLot = new Map((live ?? []).map((l) => [l.lot_id, l as Live]));
  const { data: lotFeed } = await sb.from("lots").select("id,last_feed_at");
  const in2h = new Date(Date.now() + 2 * 3600_000).toISOString();
  const { data: fc } = await sb.from("forecasts").select("lot_id,p_full").gte("target_time", new Date().toISOString()).lte("target_time", in2h);
  const maxFull = new Map<string, number>();
  for (const f of fc ?? []) maxFull.set(f.lot_id, Math.max(maxFull.get(f.lot_id) ?? 0, Number(f.p_full)));
  const feedBy = new Map((lotFeed ?? []).map((l) => [l.id, l.last_feed_at as string | null]));
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
  const rows: LotRow[] = (lots ?? []).map((l) => ({ ...l, live: byLot.get(l.id) ?? null }));
  return (
    <main className="shell">
      <div className="top"><div className="row"><span style={{ fontSize: 44 }}>🏢</span><div><h1>{t("yourLots")}</h1><p>{user?.email}</p></div></div></div>
      <div className="lift" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <Link href="/operator/lots/new" className="btn block">➕ {t("addLot")}</Link>
        <div className="chips"><Link href="/operator/analytics" className="chip">📈 {t("opTabStats")}</Link><Link href="/operator/integrations" className="chip">🔌 {t("opTabFeeds")}</Link><Link href="/driver" className="chip">🚗 {t("switchDriver")}</Link></div>
      </div>
      {alerts.length > 0 && (
        <section aria-label="Alerts" data-testid="alerts" className="card">
          <h2>Alerts</h2>
          <ul>{alerts.map((a, i) => <li key={i}><strong>{a.severity}</strong> · <Link href={`/operator/lots/${a.lotId}`}>{a.lotName}</Link>: {a.message}</li>)}</ul>
          <p style={{ fontSize: 12, color: "#a3acd0" }}>Alerts are shown here only; email and push notifications are not built yet.</p>
        </section>
      )}
      {forecasts.length > 0 && (
        <section aria-label="Revenue forecast" data-testid="revenue-forecast" className="card">
          <h2>💰 {t("revenueForecast")}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th align="left">Lot</th><th align="right">{t("expected")}</th></tr></thead>
            <tbody>{forecasts.map((f) => <tr key={f.name}><td>{f.name}{f.simulated ? " (demo)" : ""}</td><td align="right">₹{Math.round(f.totalPaise / 100).toLocaleString("en-IN")}</td></tr>)}</tbody>
          </table>
          <p style={{ fontSize: 12, color: "#a3acd0" }}>{t("revenueNote")}</p>
        </section>
      )}
      {rows.length === 0 ? <div className="card">No lots yet. Add one to get started.</div> : <LiveLots lots={rows} />}
      <form action="/auth/signout" method="post"><button type="submit" className="btn ghost block">{t("signOut")}</button></form>
    </main>
  );
}
