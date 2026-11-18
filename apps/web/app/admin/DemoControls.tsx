"use client";
import { useState } from "react";

export function DemoControls() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(scenario: string) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Applied "${scenario}" to ${j.lots} synthetic lots and refreshed forecasts.` : j.error ?? "Failed");
    setBusy(false);
  }
  return (
    <div>
      <p style={{ fontSize: 13 }}>Changes only synthetic demo lots. Prices and arrival-time availability on the driver pages follow within a minute.</p>
      <button disabled={busy} onClick={() => run("busy_saturday")}>Simulate busy Saturday (malls full, rain)</button>{" "}
      <button disabled={busy} onClick={() => run("ipl_night")}>Simulate IPL match night</button>{" "}
      <button disabled={busy} onClick={() => run("reset")}>Reset</button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
