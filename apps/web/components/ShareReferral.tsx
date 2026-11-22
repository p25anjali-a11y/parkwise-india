"use client";
import { useState } from "react";
import { useT } from "./I18n";
import { ICON } from "./icons";

export function ShareReferral({ code, link, text }: { code: string; link: string; text: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyLink"), link);
    }
  }
  function share() {
    if (typeof navigator.share === "function") void navigator.share({ text: `${text} ${link}` }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <div>
      <div className="refcode"><div><div className="muted" style={{ fontSize: 13 }}>{t("yourCode")}</div><b data-testid="ref-code">{code}</b></div></div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
        <button type="button" className="btn" onClick={share}>{ICON.share}&nbsp;{t("shareInvite")}</button>
        <button type="button" className="btn ghost" onClick={copy}>{ICON.copy}&nbsp;{copied ? t("copied") : t("copyLink")}</button>
      </div>
    </div>
  );
}
