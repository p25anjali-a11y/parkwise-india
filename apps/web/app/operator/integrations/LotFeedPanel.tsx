"use client";
import { useActionState } from "react";
import { createEndpoint, uploadCsv, type ActionState } from "./actions";

export function LotFeedPanel({ lotId, endpointId, prefix, origin }: { lotId: string; endpointId: string | null; prefix: string | null; origin: string }) {
  const [ep, epAction, epPending] = useActionState(createEndpoint.bind(null, lotId), {} as ActionState);
  const [csv, csvAction, csvPending] = useActionState(uploadCsv.bind(null, lotId), {} as ActionState);
  const id = ep.endpointId ?? endpointId;
  return (
    <div>
      <form action={epAction}>
        <button disabled={epPending} type="submit" className="btn ghost">{id ? "Rotate webhook secret" : "Create webhook endpoint"}</button>
      </form>
      {ep.error && <p role="alert" className="err">{ep.error}</p>}
      {ep.ok && <p>{ep.ok}</p>}
      {ep.secret && <p><strong>Copy this secret now; it is not shown again:</strong> <code>{ep.secret}</code></p>}
      {id && (
        <p style={{ fontSize: 13 }}>
          POST <code>{origin}/api/feeds/{id}</code> with headers <code>X-Parkwise-Timestamp</code> (unix seconds) and <code>X-Parkwise-Signature</code> = hex HMAC-SHA256 of <code>timestamp.body</code>.{prefix ? ` Current secret starts ${prefix}…` : ""}
        </p>
      )}
      <form action={csvAction} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <label className="f">CSV snapshots (captured_at,occupied)<textarea name="csv" rows={4} placeholder="2026-11-20T10:00:00+05:30,120" style={{ font: "inherit", padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--raise)", color: "var(--ink)" }} /></label>
        <button disabled={csvPending} type="submit" className="btn ghost">Upload CSV</button>
      </form>
      {csv.error && <p role="alert" className="err">{csv.error}</p>}
      {csv.ok && <p>{csv.ok}</p>}
    </div>
  );
}
