"use client";
import { useState } from "react";
import { useT } from "./I18n";

export function WaitlistButton({ lotId, joined }: { lotId: string; joined: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(joined);
  const [msg, setMsg] = useState("");
  async function join() {
    const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lotId }) });
    if (r.ok) setOn(true); else setMsg(r.status === 401 ? t("signInFirst") : (await r.json()).error ?? "Error");
  }
  return on ? <p><span className="pill green">{t("waitJoined")}</span></p> : <><button type="button" className="btn blue block" onClick={join}>{t("waitJoin")}</button>{msg && <p role="alert" className="err">{msg}</p>}</>;
}
