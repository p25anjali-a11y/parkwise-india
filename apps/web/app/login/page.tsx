"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { LangSwitch, useT } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";
import { gstinCheckChar, isValidGstin, normaliseGstin } from "../../lib/gstin";

/** Demo shortcuts (fake data only). Hide them by setting NEXT_PUBLIC_DEMO_LOGINS=off at build time. */
const DEMO_LOGINS = process.env.NEXT_PUBLIC_DEMO_LOGINS !== "off";
const DEMO_PASSWORD = "ParkDemo#2026";
const DEMOS = [
  { email: "p25anjali@iima.ac.in", kind: "operator" as const, key: "demoAnjali" },
  { email: "mumbai.operator@parkwise.example", kind: "operator" as const, key: "demoMumbai" },
  { email: "ahmedabad.operator@parkwise.example", kind: "operator" as const, key: "demoAhmedabad" },
  { email: "driver@parkwise.example", kind: "driver" as const, key: "demoDriver" },
];

/** A made-up but well-formed GSTIN (valid checksum), different each time, for demo sign-ups. Belongs to no business. */
function fakeGstin(): string {
  const L = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const first14 = `27AAAC${L()}${String(1000 + Math.floor(Math.random() * 9000))}${L()}1Z`;
  return first14 + gstinCheckChar(first14);
}

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
  const [me, setMe] = useState<{ email: string; home: string; canOperate: boolean } | null>(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "up") setMode("up"); }, []);
  // Already signed in: offer to continue to your own side, or sign out to pick the other one.
  useEffect(() => {
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const role = p?.role as string | undefined;
        setMe({ email: user.email ?? "", home: role === "platform_admin" ? "/admin" : role === "operator" || role === "operator_admin" ? "/operator" : "/search", canOperate: role === "operator" || role === "operator_admin" });
      } catch { /* not configured */ }
    })();
  }, []);

  async function submit(e: React.FormEvent | null, o?: { email: string; password: string; kind: "driver" | "operator" }) {
    e?.preventDefault();
    const em = o?.email ?? email, pw = o?.password ?? password, kd = o?.kind ?? kind, md = o ? "in" : mode;
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
      {me && (
        <div className="card" data-testid="continue-card">
          <p style={{ marginTop: 0 }}>{t("signedInAsEmail", { email: me.email })}</p>
          <div className="row" style={{ gap: 8 }}>
            {me.canOperate ? (
              <>
                <a href="/operator" className="btn blue" style={{ minHeight: 44 }}>{t("opConsole")}</a>
                <a href="/search" className="btn" style={{ minHeight: 44 }}>{t("switchDriver")}</a>
              </>
            ) : <a href={me.home} className="btn blue" style={{ minHeight: 44 }}>{t("continueBtn")}</a>}
            <form action="/auth/signout" method="post" style={{ margin: 0 }}><button type="submit" className="chip" style={{ minHeight: 44 }}>{t("signOut")}</button></form>
          </div>
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="card lift">
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
            <label className="f">{t("gstinLabel")}<input value={gstin} onChange={(e) => setGstin(e.target.value)} required minLength={15} maxLength={17} autoCapitalize="characters" aria-describedby="gstin-help" /></label>
            <p id="gstin-help" className="muted" style={{ marginTop: -6 }}>{t("gstinHelp")}</p>
            {DEMO_LOGINS && <button type="button" className="chip" style={{ minHeight: 44, marginBottom: 12 }} onClick={() => { setOrgName("Demo Mall Parking"); setGstin(fakeGstin()); }}>{t("demoFill")}</button>}
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
      {DEMO_LOGINS && mode === "in" && (
        <div className="card" data-testid="demo-logins">
          <h2 style={{ marginBottom: 4 }}>{t("demoTitle")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{t("demoHint")}</p>
          <div className="chips">
            {DEMOS.map((d) => <button key={d.email} type="button" className="chip" style={{ minHeight: 44 }} onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setKind(d.kind); void submit(null, { email: d.email, password: DEMO_PASSWORD, kind: d.kind }); }}>{t(d.key)}</button>)}
          </div>
        </div>
      )}
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
    </main>
  );
}
