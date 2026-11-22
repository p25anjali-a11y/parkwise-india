"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";
import { ICON } from "./icons";

const ITEMS = [
  { href: "/operator", key: "opOverview", ico: ICON.grid, exact: true },
  { href: "/operator/analytics", key: "opRevenue", ico: ICON.stats },
  { href: "/operator/reservations", key: "opTabBookings", ico: ICON.list },
  { href: "/operator/integrations", key: "opTabFeeds", ico: ICON.feeds },
  { href: "/operator/lots/new", key: "opTabAdd", ico: ICON.add },
];

export function OpSidebar() {
  const path = usePathname() ?? "";
  const { t } = useT();
  return (
    <aside className="opside" aria-label="Operator">
      <div className="grp">{t("opManage")}</div>
      {ITEMS.map((x) => {
        const on = x.exact ? path === x.href || path.startsWith("/operator/lots/") && !path.endsWith("/new") : path === x.href || path.startsWith(x.href + "/");
        return <Link key={x.href} href={x.href} className={on ? "on" : undefined}>{x.ico}{t(x.key)}</Link>;
      })}
      <div className="grp">{t("opSwitch")}</div>
      <Link href="/driver">{ICON.swap}{t("switchDriver")}</Link>
    </aside>
  );
}
