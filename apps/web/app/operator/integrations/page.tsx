import Link from "next/link";
import { FEED_ADAPTERS, feedHealth } from "@parkwise/providers";
import { headers } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";
import { LotFeedPanel } from "./LotFeedPanel";

export const dynamic = "force-dynamic";

export default async function Integrations() {
  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name,feed_source,last_feed_at,status").order("name");
  const admin = supabaseAdmin();
  const eps = admin && (lots ?? []).length ? (await admin.from("feed_endpoints").select("id,lot_id,secret_prefix").in("lot_id", (lots ?? []).map((l) => l.id)).eq("active", true)).data ?? [] : [];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <p><Link href="/operator">← Your lots</Link></p>
      <h1>Integrations</h1>
      <h2>Supported feeds</h2>
      <table>
        <thead><tr><th align="left">Feed</th><th align="left">Status</th><th align="left">Notes</th></tr></thead>
        <tbody>{FEED_ADAPTERS.map((a) => <tr key={a.id}><td>{a.name}</td><td><strong>{a.status}</strong></td><td>{a.note}</td></tr>)}</tbody>
      </table>
      <h2>Your lots</h2>
      {(lots ?? []).map((l) => {
        const ep = eps.find((e) => e.lot_id === l.id);
        const health = feedHealth(l.last_feed_at ? new Date(l.last_feed_at) : null);
        return (
          <section key={l.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, margin: "12px 0" }}>
            <h3>{l.name}</h3>
            <p>Feed: <strong>{l.feed_source}</strong> · {health === "live" ? "live" : health === "stale" ? "stale (over 15 min; forecasts widen)" : "no feed yet"}</p>
            <LotFeedPanel lotId={l.id} endpointId={ep?.id ?? null} prefix={ep?.secret_prefix ?? null} origin={origin} />
          </section>
        );
      })}
    </main>
  );
}
