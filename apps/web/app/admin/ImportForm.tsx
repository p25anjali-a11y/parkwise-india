"use client";
import { useState } from "react";

export function ImportForm() {
  const [kind, setKind] = useState<"calendar" | "events">("calendar");
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  async function go() {
    setMsg("");
    const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, csv }) });
    const j = await r.json();
    setMsg(r.ok ? `Imported ${j.imported} rows.` : (j.errors ?? [j.error]).join("; "));
  }
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 520 }}>
      <label>Type <select value={kind} onChange={(e) => setKind(e.target.value as "calendar" | "events")}><option value="calendar">Calendar days</option><option value="events">Events</option></select></label>
      <p style={{ fontSize: 12 }}>{kind === "calendar" ? "starts_on,ends_on,name,kind,weight (kind: holiday, festival, school_holiday, match)" : "city,name,venue,starts_at,ends_at,expected_attendance,impact"}. Check dates against an official source first.</p>
      <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button onClick={go}>Import</button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
