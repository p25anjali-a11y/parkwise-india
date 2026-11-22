import Link from "next/link";
import { getLang } from "../../../lib/lang";
import { rupees } from "../../../lib/referral";
import { supabaseServer } from "../../../lib/supabase/server";
import { operatorScope, scopedLots } from "../../../lib/operator-scope";
import { simulatedBookings } from "../../../lib/simulated-revenue";
import { DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";

export const dynamic = "force-dynamic";
const STATUSES = ["all", "held", "confirmed", "checked_in", "completed", "cancelled", "expired", "no_show"] as const;
const tone = (s: string) => (s === "confirmed" || s === "checked_in" || s === "completed" ? "green" : s === "held" ? "orange" : s === "no_show" ? "red" : "grey");

export default async function OperatorReservations({ searchParams }: { searchParams: Promise<{ status?: string; lot?: string }> }) {
  const { t } = await getLang();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "all";
  const sb = await supabaseServer();
  const scope = await operatorScope(sb);
  if (!scope) return <main className="shell"><div className="card">Sign in with an operator account to see this page.</div></main>;
  const lots = (await scopedLots(sb, scope, "id,name,category,is_synthetic,status")) as Array<{ id: string; name: string; category: string; is_synthetic: boolean; status: string }>;
  const myIds = lots.map((l) => l.id);
  const lotId = (lots ?? []).find((l) => l.id === sp.lot)?.id;
  let q = sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,created_at,lot_id,lots(name)").in("lot_id", myIds).order("arrival_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("status", status as (typeof STATUSES)[number] & string);
  if (lotId) q = q.eq("lot_id", lotId);
  const { data } = await q;
  // Demo lots with no real bookings: a labelled SIMULATED sample list so the screen is not empty.
  const simScope = (lotId ? lots.filter((l) => l.id === lotId) : lots).filter((l) => l.is_synthetic && l.status === "approved");
  const simRulesRows = !(data ?? []).length && simScope.length ? (await sb.from("price_rules").select("lot_id,rules").in("lot_id", simScope.map((l) => l.id)).eq("active", true).is("zone_id", null)).data ?? [] : [];
  const simRows = !(data ?? []).length ? simScope.flatMap((l) => simulatedBookings({ lotId: l.id, lotName: l.name, category: l.category, count: 8, rules: { ...DEFAULT_RULES, ...((simRulesRows.find((r) => r.lot_id === l.id)?.rules as Partial<PricingRules>) ?? {}) } as PricingRules })).filter((b) => status === "all" || b.status === status).sort((a, b) => b.arrival_at.localeCompare(a.arrival_at)) : [];
  const href = (o: { status?: string; lot?: string }) => `/operator/reservations?status=${o.status ?? status}${(o.lot ?? lotId) ? `&lot=${o.lot ?? lotId}` : ""}`;
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <main className="shell">
      <div className="top"><h1>{t("opTabBookings")}</h1><p>{t("bookingsSub")}</p></div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {STATUSES.map((s) => <Link key={s} href={href({ status: s })} className={s === status ? "chip on" : "chip"}>{s === "all" ? t("catAll") : s.replace("_", " ")}</Link>)}
      </div>
      {(lots ?? []).length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <Link href={href({ lot: "" })} className={!lotId ? "chip on" : "chip"}>{t("allLots")}</Link>
          {(lots ?? []).map((l) => <Link key={l.id} href={href({ lot: l.id })} className={l.id === lotId ? "chip on" : "chip"}>{l.name}</Link>)}
        </div>
      )}
      <div className="card" data-testid="op-reservations">
        {(data ?? []).length === 0 && simRows.length > 0 ? (
          <>
            <p style={{ marginTop: 0 }}><span className="sim-mark">{t("simulatedBadge")}</span></p>
            <div className="tblwrap"><table className="tbl" data-testid="sim-bookings">
              <thead><tr><th>{t("arrival")}</th><th>{t("lotCol")}</th><th className="r">{t("hoursCol")}</th><th className="r">{t("amountCol")}</th><th>{t("statusCol")}</th></tr></thead>
              <tbody>{simRows.map((r) => (
                <tr key={r.id}><td>{fmt(r.arrival_at)}</td><td>{r.lotName}</td><td className="r">{r.duration_min / 60}</td><td className="r">{rupees(r.total_paise)}</td><td><span className={`pill ${tone(r.status)}`}>{r.status.replace("_", " ")}</span></td></tr>
              ))}</tbody>
            </table></div>
          </>
        ) : (data ?? []).length === 0 ? <p className="muted" style={{ margin: 0 }}>{t("noBookingsYet")}</p> : (
          <div className="tblwrap"><table className="tbl">
            <thead><tr><th>{t("arrival")}</th><th>{t("lotCol")}</th><th className="r">{t("hoursCol")}</th><th className="r">{t("amountCol")}</th><th>{t("statusCol")}</th></tr></thead>
            <tbody>{(data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.arrival_at)}</td>
                <td>{(r.lots as unknown as { name: string } | null)?.name ?? "—"}</td>
                <td className="r">{r.duration_min / 60}</td>
                <td className="r">{rupees(r.total_paise)}</td>
                <td><span className={`pill ${tone(r.status)}`}>{r.status.replace("_", " ")}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <p className="muted">{t("scannerNote")}</p>
    </main>
  );
}
