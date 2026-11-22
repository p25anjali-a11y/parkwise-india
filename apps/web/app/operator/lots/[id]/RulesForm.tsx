"use client";
import { useActionState } from "react";
import { saveRules } from "./actions";

export function RulesForm({ lotId, base, floor, ceiling, dynamic }: { lotId: string; base: number; floor: number; ceiling: number; dynamic: boolean }) {
  const [s, action, pending] = useActionState(saveRules.bind(null, lotId), {} as { error?: string; ok?: boolean });
  const f = { display: "grid", gap: 6, color: "var(--muted)", fontSize: 14, fontWeight: 500 } as const;
  return (
    <form action={action} style={{ display: "grid", gap: 14, maxWidth: 400 }}>
      <label style={f}>Base rate (₹/hour)<input name="baseRupeesPerHour" type="number" step="0.5" defaultValue={base} /></label>
      <label style={f}>Floor multiplier<input name="floorMultiplier" type="number" step="0.05" defaultValue={floor} /></label>
      <label style={f}>Ceiling multiplier<input name="ceilingMultiplier" type="number" step="0.05" defaultValue={ceiling} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input name="dynamicEnabled" type="checkbox" defaultChecked={dynamic} style={{ width: 22, minHeight: 22, accentColor: "#c9a96a" }} /> Dynamic pricing on</label>
      <button disabled={pending} type="submit" className="btn">{pending ? "Saving…" : "Save pricing"}</button>
      {s.error && <p role="alert" className="err">{s.error}</p>}
      {s.ok && <p>Saved.</p>}
    </form>
  );
}
