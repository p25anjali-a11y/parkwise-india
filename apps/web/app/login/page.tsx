"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { LangSwitch, useT } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";

export default function Login() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const sb = supabaseBrowser();
    const plate = carPlate.trim().toUpperCase();
    const { error } =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { data: { car_model: carModel.trim(), car_plate: plate } } });
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg(t("checkEmail"));
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/driver";
  }

  return (
    <main className="shell">
      <div className="top">
        <div className="row">
          <Mascot size={64} />
          <h1>{mode === "in" ? t("signIn") : t("createAccount")}</h1>
        </div>
      </div>
      <form onSubmit={submit} className="card lift">
        <label className="f">{t("email")}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">{t("password")}<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {mode === "up" && (
          <>
            <label className="f">🚗 {t("carModel")}<input value={carModel} onChange={(e) => setCarModel(e.target.value)} maxLength={60} /></label>
            <label className="f">🔢 {t("carPlate")}<input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} maxLength={14} autoCapitalize="characters" /></label>
          </>
        )}
        <button type="submit" className="btn blue block">{mode === "in" ? t("signIn") : t("signUp")}</button>
        {msg && <p className="err" role="alert">{msg}</p>}
        <p style={{ textAlign: "center", marginBottom: 0 }}>
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="chip">
            {mode === "in" ? t("newHere") : t("haveAccount")}
          </button>
        </p>
      </form>
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
    </main>
  );
}
