"use client";
import { useState } from "react";
import { useT } from "./I18n";

export function JoinOperator({ cities, defaultName = "", defaultCity = "Mumbai" }: { cities: readonly string[]; defaultName?: string; defaultCity?: string }) {
  const { t } = useT();
  const [orgName, setOrgName] = useState(defaultName);
  const [city, setCity] = useState(defaultCity);
  const [msg, setMsg] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/operator/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgName, city }) });
    if (r.ok) window.location.href = "/operator";
    else setMsg(r.status === 401 ? t("signInFirst") : (await r.json()).error ?? "Error");
  }
  return (
    <form onSubmit={go}>
      <label className="f">🏢 {t("businessName")}<input value={orgName} onChange={(e) => setOrgName(e.target.value)} required minLength={2} maxLength={80} /></label>
      <label className="f">📍 {t("businessCity")}<select value={city} onChange={(e) => setCity(e.target.value)}>{cities.map((c) => <option key={c}>{c}</option>)}</select></label>
      <button className="btn green block" type="submit">{t("joinBtn")}</button>
      {msg && <p role="alert" className="err">{msg}</p>}
    </form>
  );
}
