import Link from "next/link";
import { FEED_ADAPTERS, feedHealth } from "@parkwise/providers";
import { headers } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";
import { operatorScope, scopedLots } from "../../../lib/operator-scope";
import { LotFeedPanel } from "./LotFeedPanel";

export const dynamic = "force-dynamic";

export default async function Integrations() {
  const sb = await supabaseServer();
  const scope = await operatorScope(sb);
  if (!scope) return <main className="shell"><div className="card">Sign in with an operator account to see this page.</div></main>;
  const lots = (await scopedLots(sb, scope, "id,name,feed_source,last_feed_at,status")) as Array<{ id: string; name: string; feed_source: string | null; last_feed_at: string | null; status: string }>;
  const admin = supabaseAdmin();
  const eps = admin && (lots ?? []).length ? (await admin.from("feed_endpoints").select("id,lot_id,secret_prefix").in("lot_id", (lots ?? []).map((l) => l.id)).eq("active", true)).data ?? [] : [];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  return (
    <main className="shell">
      <div className="top"><p style={{ margin: 0 }}><Link href="/operator">← Your lots</Link></p><h1 style={{ marginTop: 8 }}>Integrations</h1></div>
      <div className="card"><h2>Supported feeds</h2>
      <div className="tblwrap"><table className="tbl">
        <thead><tr><th>Feed</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>{FEED_ADAPTERS.map((a) => <tr key={a.id}><td>{a.name}</td><td><span className="pill grey">{a.status}</span></td><td>{a.note}</td></tr>)}</tbody>
      </table></div></div>
      {(lots ?? []).map((l) => {
        const ep = eps.find((e) => e.lot_id === l.id);
        const health = feedHealth(l.last_feed_at ? new Date(l.last_feed_at) : null);
        return (
          <section key={l.id} className="card">
            <h3>{l.name}</h3>
            <p>Feed: <strong>{l.feed_source}</strong> · <span className={`pill ${health === "live" ? "green" : health === "stale" ? "orange" : "grey"}`}>{health === "live" ? "live" : health === "stale" ? "stale (over 15 min; forecasts widen)" : "no feed yet"}</span></p>
            <LotFeedPanel lotId={l.id} endpointId={ep?.id ?? null} prefix={ep?.secret_prefix ?? null} origin={origin} />
          </section>
        );
      })}
    </main>
  );
}
