"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "./I18n";

const I = (d: ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const ICON = {
  search: I(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  live: I(<><path d="M3 15h18M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>),
  trips: I(<><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M14 6v12" strokeDasharray="2 2.5" /></>),
  me: I(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  lots: I(<><path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" /></>),
  add: I(<><path d="M12 5v14M5 12h14" /></>),
  stats: I(<><path d="M5 20V11M12 20V5M19 20v-7" /></>),
  feeds: I(<><path d="M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0" /><circle cx="12" cy="12" r="0.8" /><path d="M12 13v7" /></>),
  swap: I(<><path d="M7 7h12l-3-3M17 17H5l3 3" /></>),
};

const OP_TABS = [
  { href: "/operator", key: "opTabLots", ico: ICON.lots, match: ["/operator"] },
  { href: "/operator/lots/new", key: "opTabAdd", ico: ICON.add, match: ["/operator/lots/new"] },
  { href: "/operator/analytics", key: "opTabStats", ico: ICON.stats, match: ["/operator/analytics"] },
  { href: "/operator/integrations", key: "opTabFeeds", ico: ICON.feeds, match: ["/operator/integrations"] },
  { href: "/driver", key: "switchDriver", ico: ICON.swap, match: [] as string[] },
];

const TABS = [
  { href: "/search", key: "tabFind", ico: ICON.search, match: ["/search", "/lots"] },
  { href: "/live", key: "tabLive", ico: ICON.live, match: ["/live"] },
  { href: "/driver/reservations", key: "tabTrips", ico: ICON.trips, match: ["/driver/reservations"] },
  { href: "/driver", key: "tabMe", ico: ICON.me, match: ["/driver", "/login"] },
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
          <span className="ico">{x.ico}</span>
          {t(x.key)}
        </Link>
      ))}
    </nav>
  );
}
