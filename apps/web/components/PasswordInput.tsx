"use client";
import { useState } from "react";
import { useT } from "./I18n";
import { ICON } from "./icons";

/** Password field with a show / hide button (44px tap target). */
export function PasswordInput({ value, onChange, autoComplete, minLength = 8 }: { value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const label = show ? t("hidePassword") : t("showPassword");
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input type={show ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)} required style={{ paddingRight: 52 }} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={label} aria-pressed={show} title={label} data-testid="toggle-password"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, minHeight: 44, background: "none", border: 0, color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {show ? ICON.eyeOff : ICON.eye}
      </button>
    </span>
  );
}
