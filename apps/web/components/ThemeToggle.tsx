"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Theme = "dark" | "light";
const KEY = "pw_theme";

/** Dark / light switch. The choice is remembered on this device; the page applies it before first paint (see layout). */
export function ThemeToggle({ variant }: { variant: "float" | "inbar" }) {
  const { t } = useT();
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();
    window.addEventListener("pw-theme", read);
    return () => window.removeEventListener("pw-theme", read);
  }, []);
  function flip() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: still applies for this visit */ }
    window.dispatchEvent(new Event("pw-theme"));
  }
  const label = theme === "dark" ? t("themeLight") : t("themeDark");
  const short = theme === "dark" ? t("themeLightLabel") : t("themeDarkLabel");
  return (
    <button type="button" className={`themebtn ${variant}`} onClick={flip} aria-label={label} title={label} data-testid={`theme-${variant}`}>
      {theme === "dark" ? ICON.sun : ICON.moon}<span className="themelbl">{short}</span>
    </button>
  );
}
