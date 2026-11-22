"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase/browser";
import { useT } from "../../../components/I18n";
import { Mascot } from "../../../components/Mascot";

export default function Reset() {
  const { t } = useT();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("expired")) setExpired(true); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return setExpired(true);
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) return setMsg(error.message);
      await sb.auth.signOut();
      setDone(true);
    } catch {
      setMsg(t("resetUnavailable"));
    }
  }
  return (
    <main className="shell">
      <div className="top"><div className="row"><Mascot size={64} /><h1>{t("resetTitle")}</h1></div></div>
      <div className="card lift">
        {done ? (
          <>
            <p role="status" style={{ marginTop: 0 }}>{t("passwordUpdated")}</p>
            <Link href="/login" className="btn blue block">{t("signIn")}</Link>
          </>
        ) : expired ? (
          <>
            <p role="alert" style={{ marginTop: 0 }}>{t("resetExpired")}</p>
            <Link href="/auth/forgot" className="btn blue block">{t("sendReset")}</Link>
          </>
        ) : (
          <form onSubmit={go}>
            <label className="f">{t("newPassword")}<input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
            <button type="submit" className="btn blue block">{t("savePassword")}</button>
            {msg && <p className="err" role="alert">{msg}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
