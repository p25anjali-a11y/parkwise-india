"use client";
import { useEffect, useState } from "react";
import { REF_COOKIE, REFERRAL_GET_PAISE, rupees } from "../lib/referral";
import { useT } from "./I18n";

/** If the visitor arrived through an invite link, apply the code once they are signed in, then forget it. */
export function ClaimReferral() {
  const { t } = useT();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const m = document.cookie.split("; ").find((c) => c.startsWith(`${REF_COOKIE}=`));
    if (!m) return;
    const code = decodeURIComponent(m.split("=")[1] ?? "");
    fetch("/api/referrals/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async (r) => {
        if (r.status === 401) return; // not signed in yet: keep the cookie
        const j = await r.json().catch(() => ({}));
        document.cookie = `${REF_COOKIE}=; path=/; max-age=0`;
        if (j.result === "ok") setOk(true);
      })
      .catch(() => undefined);
  }, []);
  if (!ok) return null;
  return <div className="banner" role="status"><strong>{t("refApplied", { amt: rupees(REFERRAL_GET_PAISE) })}</strong></div>;
}
