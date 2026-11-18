import Link from "next/link";
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
  const rows: LotRow[] = (lots ?? []).map((l) => ({ ...l, live: byLot.get(l.id) ?? null }));
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Your lots</h1>
      <p>{user?.email} · <Link href="/operator/lots/new">Add a lot</Link></p>
      {rows.length === 0 ? <p>No lots yet. Add one to get started.</p> : <LiveLots lots={rows} />}
      <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
    </main>
  );
}
