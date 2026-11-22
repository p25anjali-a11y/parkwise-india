"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";
import { ICON } from "./icons";
import { Mascot } from "./Mascot";

const DRIVER = [
  { href: "/search", key: "tabFind", match: ["/search", "/lots", "/trip"] },
  { href: "/live", key: "tabLive", match: ["/live"] },
  { href: "/driver/reservations", key: "tabTrips", match: ["/driver/reservations"] },
  { href: "/rewards", key: "tabRewards", match: ["/rewards"] },
  { href: "/driver", key: "tabMe", match: ["/driver", "/login"] },
];

/** Desktop top bar (hidden below 900px, where the bottom tab bar is used). Find parking is always the first tab. */
export function SiteNav() {
  const path = usePathname() ?? "/";
  const { t } = useT();
  if (path.startsWith("/admin")) return null;
  const operator = path.startsWith("/operator");
  const active = DRIVER.filter((x) => x.match.some((m) => path === m || path.startsWith(m + "/"))).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <header className="sitenav">
      <Link href={operator ? "/operator" : "/search"} className="brand"><Mascot size={30} /> Parkwise India</Link>
      {operator ? (
        <>
          <span className="tag">{t("opConsole")}</span>
          <span className="grow" />
          <nav aria-label="Switch"><Link href="/driver">{ICON.swap}{t("switchDriver")}</Link></nav>
        </>
      ) : (
        <>
          <nav aria-label="Main">
            {DRIVER.map((x) => <Link key={x.href} href={x.href} className={x === active ? "on" : undefined}>{t(x.key)}</Link>)}
          </nav>
          <span className="grow" />
          <nav aria-label="Operators"><Link href="/operator">{t("iRunLot")}</Link></nav>
        </>
      )}
    </header>
  );
}
