import { cookies } from "next/headers";
import { asLang, LANG_COOKIE, translate, translateLabel, type Lang } from "./i18n";

/** Server components: the visitor's language from the cookie, with a translator bound to it. */
export async function getLang(): Promise<{ lang: Lang; t: (k: string) => string; tl: (label: string) => string }> {
  const lang = asLang((await cookies()).get(LANG_COOKIE)?.value);
  return { lang, t: (k) => translate(lang, k), tl: (l) => translateLabel(lang, l) };
}
