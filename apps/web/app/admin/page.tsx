import { feedHealth } from "@parkwise/providers";
import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";
import { setLotStatus } from "./actions";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!hasSupabaseEnv()) return <main style={{ padding: 24 }}>Supabase is not configured for this deployment.</main>;
  const sb = await supabaseServer();
  const [lots, health, audit] = await Promise.all([
    sb.from("lots").select("id,name,city,status,last_feed_at").order("status").order("name"),
    sb.from("data_source_health").select("source,kind,is_mock,last_success_at,last_error_at,last_error,success_count,error_count"),
    sb.from("audit_log").select("created_at,action,entity_id,reason").order("created_at", { ascending: false }).limit(15),
  ]);
  const pending = (lots.data ?? []).filter((l) => l.status === "pending_approval");
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Admin</h1>
      <h2>Lots awaiting approval ({pending.length})</h2>
      {pending.length === 0 && <p>None.</p>}
      {pending.map((l) => (
        <form key={l.id} action={setLotStatus.bind(null, l.id, "approve")} style={{ margin: "8px 0" }}>
          {l.name} ({l.city}) <input name="reason" placeholder="Note (optional)" /> <button type="submit">Approve</button>
        </form>
      ))}
      <h2>All lots</h2>
      <table>
        <thead><tr><th align="left">Lot</th><th align="left">Status</th><th align="left">Feed</th><th /></tr></thead>
        <tbody>
          {(lots.data ?? []).map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              <td>{l.status}</td>
              <td>{feedHealth(l.last_feed_at ? new Date(l.last_feed_at) : null)}</td>
              <td>
                {l.status === "approved" && <form action={setLotStatus.bind(null, l.id, "suspend")}><input name="reason" placeholder="Reason" required /> <button type="submit">Suspend</button></form>}
                {l.status === "suspended" && <form action={setLotStatus.bind(null, l.id, "approve")}><input name="reason" placeholder="Reason" /> <button type="submit">Reinstate</button></form>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Data source health</h2>
      <table>
        <thead><tr><th align="left">Source</th><th align="left">Mode</th><th align="left">Last success</th><th align="left">Last error</th></tr></thead>
        <tbody>
          {(health.data ?? []).map((h) => (
            <tr key={h.source}>
              <td>{h.source} ({h.kind})</td>
              <td>{h.is_mock ? "MOCK / not connected" : "real"}</td>
              <td>{h.last_success_at ? new Date(h.last_success_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "never"}</td>
              <td>{h.last_error ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Import calendar or events</h2>
      <ImportForm />
      <h2>Recent admin actions</h2>
      <ul>{(audit.data ?? []).map((a, i) => <li key={i}>{new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {a.action} · {a.entity_id} {a.reason ? `· ${a.reason}` : ""}</li>)}</ul>
      <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
    </main>
  );
}
