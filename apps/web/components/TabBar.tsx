"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";

const TABS = [
  { href: "/search", key: "tabFind", ico: "🔎", match: ["/search", "/lots"] },
  { href: "/live", key: "tabLive", ico: "🚗", match: ["/live"] },
  { href: "/driver/reservations", key: "tabTrips", ico: "🎟️", match: ["/driver/reservations"] },
  { href: "/driver", key: "tabMe", ico: "😊", match: ["/driver", "/login"] },
];

export function TabBar() {
  const path = usePathname() ?? "/";
  const { t } = useT();
  if (path === "/" || path.startsWith("/operator") || path.startsWith("/admin")) return null;
  const active = TABS.filter((x) => x.match.some((m) => path === m || path.startsWith(m + "/"))).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((x) => (
        <Link key={x.href} href={x.href} className={x === active ? "tab on" : "tab"}>
          <span className="ico" aria-hidden>{x.ico}</span>
          {t(x.key)}
        </Link>
      ))}
    </nav>
  );
}
