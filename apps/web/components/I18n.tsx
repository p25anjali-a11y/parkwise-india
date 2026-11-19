"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_COOKIE, translate, translateLabel, type Lang } from "../lib/i18n";

const Ctx = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

/** Client components: translator for the visitor's language. */
export function useT() {
  const lang = useContext(Ctx);
  return { lang, t: (k: string) => translate(lang, k), tl: (l: string) => translateLabel(lang, l) };
}

export function LangSwitch() {
  const { lang } = useT();
  const router = useRouter();
  function pick(code: string) {
    document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <div className="langs" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} type="button" className={l.code === lang ? "chip on" : "chip"} onClick={() => pick(l.code)} lang={l.code}>
          {l.name}
        </button>
      ))}
    </div>
  );
}
