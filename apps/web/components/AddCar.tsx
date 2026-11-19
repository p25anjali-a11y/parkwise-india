"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./I18n";

export function AddCar() {
  const { t } = useT();
  const router = useRouter();
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [msg, setMsg] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, plate }) });
    if (r.ok) { setModel(""); setPlate(""); setMsg(""); router.refresh(); } else setMsg((await r.json()).error ?? "Error");
  }
  return (
    <form onSubmit={add}>
      <label className="f">{t("carModel")}<input value={model} onChange={(e) => setModel(e.target.value)} required minLength={2} /></label>
      <label className="f">{t("carPlate")}<input value={plate} onChange={(e) => setPlate(e.target.value)} required minLength={6} /></label>
      <button className="btn blue block" type="submit">🚗 {t("addCar")}</button>
      {msg && <p role="alert" className="err">{msg}</p>}
    </form>
  );
}
