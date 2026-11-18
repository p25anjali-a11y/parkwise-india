import Link from "next/link";
import { computeAlerts } from "../../lib/alerts";
import { LiveLots, type LotRow, type Live } from "../../components/LiveOccupancy";
import { hasSupabaseEnv } from "../../lib/env";
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
  const rows: LotRow[] = (lots ?? []).map((l) => ({ ...l, live: byLot.get(l.id) ?? null }));
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Your lots</h1>
      <p>{user?.email} · <Link href="/operator/lots/new">Add a lot</Link> · <Link href="/operator/integrations">Integrations</Link> · <Link href="/operator/analytics">Analytics</Link></p>
      {alerts.length > 0 && (
        <section aria-label="Alerts" data-testid="alerts">
          <h2>Alerts</h2>
          <ul>{alerts.map((a, i) => <li key={i}><strong>{a.severity}</strong> · <Link href={`/operator/lots/${a.lotId}`}>{a.lotName}</Link>: {a.message}</li>)}</ul>
          <p style={{ fontSize: 12, color: "#555" }}>Alerts are shown here only; email and push notifications are not built yet.</p>
        </section>
      )}
      {rows.length === 0 ? <p>No lots yet. Add one to get started.</p> : <LiveLots lots={rows} />}
      <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
    </main>
  );
}
