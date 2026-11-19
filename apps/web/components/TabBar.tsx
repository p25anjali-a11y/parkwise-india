"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";

const OP_TABS = [
  { href: "/operator", key: "opTabLots", ico: "🏢", match: ["/operator"] },
  { href: "/operator/lots/new", key: "opTabAdd", ico: "➕", match: ["/operator/lots/new"] },
  { href: "/operator/analytics", key: "opTabStats", ico: "📈", match: ["/operator/analytics"] },
  { href: "/operator/integrations", key: "opTabFeeds", ico: "🔌", match: ["/operator/integrations"] },
  { href: "/driver", key: "switchDriver", ico: "🚗", match: [] },
];

const TABS = [
  { href: "/search", key: "tabFind", ico: "🔎", match: ["/search", "/lots"] },
  { href: "/live", key: "tabLive", ico: "🚗", match: ["/live"] },
  { href: "/driver/reservations", key: "tabTrips", ico: "🎟️", match: ["/driver/reservations"] },
  { href: "/driver", key: "tabMe", ico: "😊", match: ["/driver", "/login"] },
];

export function TabBar() {
  const path = usePathname() ?? "/";
  const { t } = useT();
  if (path === "/" || path.startsWith("/admin")) return null;
  const tabs = path.startsWith("/operator") ? OP_TABS : TABS;
  const active = tabs.filter((x) => x.match.some((m) => path === m || path.startsWith(m + "/"))).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((x) => (
        <Link key={x.href} href={x.href} className={x === active ? "tab on" : "tab"}>
          <span className="ico" aria-hidden>{x.ico}</span>
          {t(x.key)}
        </Link>
      ))}
    </nav>
  );
}
