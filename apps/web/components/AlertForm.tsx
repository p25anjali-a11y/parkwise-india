"use client";
import { useState } from "react";
import { useT } from "./I18n";

export function AlertForm({ lotId, suggested }: { lotId: string; suggested: number }) {
  const { t } = useT();
  const [v, setV] = useState(String(suggested));
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lotId, targetRupees: Number(v) }) });
    setMsg(r.status === 401 ? t("signInFirst") : r.ok ? t("alertSaved") : (await r.json()).error ?? "Error");
  }
  return (
    <form onSubmit={save}>
      <h2>🔔 {t("priceAlert")}</h2>
      <p className="muted">{t("alertHint")}</p>
      <label className="f">₹/hr<input type="number" inputMode="numeric" min={1} max={5000} value={v} onChange={(e) => setV(e.target.value)} required /></label>
      <button className="btn blue block" type="submit">{t("alertSet")}</button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
