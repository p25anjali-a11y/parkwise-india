"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { LangSwitch, useT } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";
import { PasswordInput } from "../../components/PasswordInput";
import { isValidGstin, normaliseGstin } from "../../lib/gstin";

export default function Login() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [kind, setKind] = useState<"driver" | "operator">("driver");
  const [orgName, setOrgName] = useState("");
  const [orgCity, setOrgCity] = useState("Mumbai");
  const [gstin, setGstin] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "up") setMode("up"); }, []);

  /** Guest: a private anonymous session (Supabase anonymous sign-in) with an ordinary driver profile. Needs "Allow anonymous sign-ins" on in Supabase Auth. */
  async function guest() {
    setMsg("");
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInAnonymously({ options: { data: { display_name: "Guest", account_type: "driver" } } });
    if (error) return setMsg(/anonymous/i.test(error.message) ? t("guestOff") : error.message);
    window.location.href = "/search";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email, pw = password, kd = kind, md = mode;
    setMsg("");
    if (md === "up" && kd === "operator" && !isValidGstin(gstin)) return setMsg(t("gstinBad"));
    const sb = supabaseBrowser();
    const plate = carPlate.trim().toUpperCase();
    const { error } =
      md === "in"
        ? await sb.auth.signInWithPassword({ email: em, password: pw })
        : await sb.auth.signUp({ email: em, password: pw, options: { data: kd === "operator" ? { account_type: "operator", org_name: orgName.trim(), org_city: orgCity, gstin: normaliseGstin(gstin) } : { account_type: "driver", car_model: carModel.trim(), car_plate: plate } } });
    if (error) return setMsg(error.message);
    if (md === "up") return setMsg(t("checkEmail"));
    const { data: { user } } = await sb.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as { account_type?: string; org_name?: string; org_city?: string; gstin?: string };
    const { data: prof } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
    const isOpAccount = prof?.role === "operator" || prof?.role === "operator_admin" || (meta.account_type === "operator" && !!meta.org_name);
    if (prof?.role !== "platform_admin") {
      if (kd === "operator" && !isOpAccount) { await sb.auth.signOut(); return setMsg(t("wrongRoleDrv")); }
    }
    if (meta.account_type === "operator" && prof?.role === "driver" && meta.org_name) {
      const j = await fetch("/api/operator/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgName: meta.org_name, city: meta.org_city ?? "Mumbai", gstin: meta.gstin ?? "" }) });
      if (!j.ok) { const e = (await j.json().catch(() => ({}))) as { error?: string }; await sb.auth.signOut(); return setMsg(e.error ?? "Could not set up your business."); }
      window.location.href = "/operator";
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") && (next.startsWith("/operator") ? kd === "operator" : kd === "driver") ? next : prof?.role === "platform_admin" ? "/admin" : kd === "operator" ? "/operator" : "/search";
  }

  return (
    <main className="shell">
      <div className="top">
        <div className="row">
          <Mascot size={64} />
          <h1>{mode === "in" ? t("signIn") : t("createAccount")}</h1>
        </div>
      </div>
      <form onSubmit={(e) => void submit(e)} className="card lift">
        {(
          <div className="chips" style={{ marginBottom: 12 }} role="group" aria-label="Account type">
            <button type="button" className={kind === "driver" ? "chip on" : "chip"} onClick={() => setKind("driver")}>{t("iAmDriver")}</button>
            <button type="button" className={kind === "operator" ? "chip on" : "chip"} onClick={() => setKind("operator")}>{t("iRunLot")}</button>
          </div>
        )}
        <label className="f">{t("email")}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">{t("password")}<PasswordInput value={password} onChange={setPassword} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
        {mode === "up" && kind === "operator" && (
          <>
            <label className="f">{t("businessName")}<input value={orgName} onChange={(e) => setOrgName(e.target.value)} required minLength={2} maxLength={80} /></label>
            <label className="f">{t("businessCity")}<select value={orgCity} onChange={(e) => setOrgCity(e.target.value)}><option>Mumbai</option><option>Ahmedabad</option></select></label>
            <label className="f">{t("gstinLabel")}<input value={gstin} onChange={(e) => setGstin(e.target.value)} required minLength={15} maxLength={17} autoCapitalize="characters" aria-describedby="gstin-help" /></label>
            <p id="gstin-help" className="muted" style={{ marginTop: -6 }}>{t("gstinHelp")}</p>
          </>
        )}
        {mode === "up" && kind === "driver" && (
          <>
            <label className="f">{t("carModel")}<input value={carModel} onChange={(e) => setCarModel(e.target.value)} maxLength={60} /></label>
            <label className="f">{t("carPlate")}<input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} maxLength={14} autoCapitalize="characters" /></label>
          </>
        )}
        <button type="submit" className="btn blue block">{mode === "in" ? t("signIn") : t("signUp")}</button>
        {msg && <p className="err" role="alert">{msg}</p>}
        {mode === "in" && <p style={{ textAlign: "center", marginBottom: 8 }}><a href="/auth/forgot" data-testid="forgot-link" style={{ display: "inline-block", padding: "10px 6px" }}>{t("forgotLink")}</a></p>}
        <p style={{ textAlign: "center", marginBottom: 0 }}>
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="chip">
            {mode === "in" ? t("newHere") : t("haveAccount")}
          </button>
        </p>
      </form>
      {mode === "in" && (
        <div className="card" data-testid="guest-entry">
          <button type="button" className="btn block" style={{ minHeight: 44 }} onClick={() => void guest()}>{t("guestBtn")}</button>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0, textAlign: "center" }}>{t("guestNote")}</p>
        </div>
      )}
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
    </main>
  );
}
