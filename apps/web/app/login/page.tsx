"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { LangSwitch, useT } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";

export default function Login() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [kind, setKind] = useState<"driver" | "operator">("driver");
  const [orgName, setOrgName] = useState("");
  const [orgCity, setOrgCity] = useState("Mumbai");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "up") setMode("up"); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const sb = supabaseBrowser();
    const plate = carPlate.trim().toUpperCase();
    const { error } =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { data: kind === "operator" ? { account_type: "operator", org_name: orgName.trim(), org_city: orgCity } : { account_type: "driver", car_model: carModel.trim(), car_plate: plate } } });
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg(t("checkEmail"));
    const { data: { user } } = await sb.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as { account_type?: string; org_name?: string; org_city?: string };
    const { data: prof } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
    const isOpAccount = prof?.role === "operator" || prof?.role === "operator_admin" || (meta.account_type === "operator" && !!meta.org_name);
    if (prof?.role !== "platform_admin") {
      if (kind === "driver" && isOpAccount) { await sb.auth.signOut(); return setMsg(t("wrongRoleOp")); }
      if (kind === "operator" && !isOpAccount) { await sb.auth.signOut(); return setMsg(t("wrongRoleDrv")); }
    }
    if (meta.account_type === "operator" && prof?.role === "driver" && meta.org_name) {
      await fetch("/api/operator/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgName: meta.org_name, city: meta.org_city ?? "Mumbai" }) });
      window.location.href = "/operator";
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") && (next.startsWith("/operator") ? kind === "operator" : kind === "driver") ? next : prof?.role === "platform_admin" ? "/admin" : prof?.role && prof.role !== "driver" ? "/operator" : "/search";
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
        {(
          <div className="chips" style={{ marginBottom: 12 }} role="group" aria-label="Account type">
            <button type="button" className={kind === "driver" ? "chip on" : "chip"} onClick={() => setKind("driver")}>{t("iAmDriver")}</button>
            <button type="button" className={kind === "operator" ? "chip on" : "chip"} onClick={() => setKind("operator")}>{t("iRunLot")}</button>
          </div>
        )}
        <label className="f">{t("email")}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">{t("password")}<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {mode === "up" && kind === "operator" && (
          <>
            <label className="f">{t("businessName")}<input value={orgName} onChange={(e) => setOrgName(e.target.value)} required minLength={2} maxLength={80} /></label>
            <label className="f">{t("businessCity")}<select value={orgCity} onChange={(e) => setOrgCity(e.target.value)}><option>Mumbai</option><option>Ahmedabad</option></select></label>
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
