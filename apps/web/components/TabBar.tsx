"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";
import { ICON } from "./icons";
import { useCanOperate } from "../lib/use-can-operate";

const OP_TABS = [
  { href: "/operator", key: "opTabLots", ico: ICON.grid, match: ["/operator"] },
  { href: "/operator/analytics", key: "opTabStats", ico: ICON.stats, match: ["/operator/analytics"] },
  { href: "/operator/reservations", key: "opTabBookings", ico: ICON.list, match: ["/operator/reservations"] },
  { href: "/operator/integrations", key: "opTabFeeds", ico: ICON.feeds, match: ["/operator/integrations"] },
  { href: "/search", key: "switchDriver", ico: ICON.swap, match: [] as string[] },
];

const TABS = [
  { href: "/search", key: "tabFind", ico: ICON.search, match: ["/search", "/lots", "/trip"] },
  { href: "/live", key: "tabLive", ico: ICON.live, match: ["/live"] },
  { href: "/driver/reservations", key: "tabTrips", ico: ICON.trips, match: ["/driver/reservations"] },
  { href: "/rewards", key: "tabRewards", ico: ICON.gift, match: ["/rewards"] },
  { href: "/driver", key: "tabMe", ico: ICON.me, match: ["/driver", "/login"] },
];
const OPERATE_TAB = { href: "/operator", key: "opConsole", ico: ICON.grid, match: [] as string[] };

export function TabBar() {
  const path = usePathname() ?? "/";
  const { t } = useT();
  const canOperate = useCanOperate();
  if (path === "/" || path === "/login" || path.startsWith("/admin")) return null;
  const tabs = path.startsWith("/operator") ? OP_TABS : canOperate ? [...TABS, OPERATE_TAB] : TABS;
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
