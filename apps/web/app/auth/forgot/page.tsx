"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase/browser";
import { useT } from "../../../components/I18n";
import { Mascot } from "../../../components/Mascot";

export default function Forgot() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` });
      if (error && error.status !== 400 && error.status !== 404) return setMsg(error.message);
      setSent(true); // the same answer whether or not the address has an account
    } catch {
      setMsg(t("resetUnavailable"));
    }
  }
  return (
    <main className="shell">
      <div className="top"><div className="row"><Mascot size={64} /><h1>{t("forgotTitle")}</h1></div></div>
      <form onSubmit={go} className="card lift">
        {sent ? (
          <p role="status" style={{ margin: 0 }}>{t("resetSent")}</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{t("forgotHelp")}</p>
            <label className="f">{t("email")}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <button type="submit" className="btn blue block">{t("sendReset")}</button>
            {msg && <p className="err" role="alert">{msg}</p>}
          </>
        )}
        <p style={{ textAlign: "center", marginBottom: 0 }}><Link href="/login" className="chip">{t("backToSignIn")}</Link></p>
      </form>
    </main>
  );
}
