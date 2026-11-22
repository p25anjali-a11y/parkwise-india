import Link from "next/link";
import { getLang } from "../../../lib/lang";
import { rupees } from "../../../lib/referral";
import { supabaseServer } from "../../../lib/supabase/server";
import { operatorScope, scopedLots } from "../../../lib/operator-scope";
import { simulatedVisits, type Channel } from "../../../lib/simulated-revenue";
import { DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";

export const dynamic = "force-dynamic";
const STATUSES = ["all", "held", "confirmed", "checked_in", "completed", "cancelled", "expired", "no_show"] as const;
const tone = (s: string) => (s === "confirmed" || s === "checked_in" || s === "completed" ? "green" : s === "held" ? "orange" : s === "no_show" ? "red" : "grey");

export default async function OperatorReservations({ searchParams }: { searchParams: Promise<{ status?: string; lot?: string; ch?: string }> }) {
  const { t } = await getLang();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "all";
  const sb = await supabaseServer();
  const scope = await operatorScope(sb);
  if (!scope) return <main className="shell"><div className="card">Sign in with an operator account to see this page.</div></main>;
  const lots = (await scopedLots(sb, scope, "id,name,city,category,is_synthetic,status")) as Array<{ id: string; name: string; city: string; category: string; is_synthetic: boolean; status: string }>;
  const myIds = lots.map((l) => l.id);
  const lotId = (lots ?? []).find((l) => l.id === sp.lot)?.id;
  let q = sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,created_at,lot_id,lots(name)").in("lot_id", myIds).order("arrival_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("status", status as (typeof STATUSES)[number] & string);
  if (lotId) q = q.eq("lot_id", lotId);
  const { data } = await q;
  // Demo lots: a labelled SIMULATED list of vehicles, some booked in the app and most paid at the gate, mixed in with real bookings.
  // Parkwise charges the same dynamic price either way.
  const ch = sp.ch === "app" || sp.ch === "gate" ? (sp.ch as Channel) : "all";
  const simScope = (lotId ? lots.filter((l) => l.id === lotId) : lots).filter((l) => l.is_synthetic && l.status === "approved");
  const simRulesRows = simScope.length ? (await sb.from("price_rules").select("lot_id,rules").in("lot_id", simScope.map((l) => l.id)).eq("active", true).is("zone_id", null)).data ?? [] : [];
  type Row = { id: string; at: string; lotName: string; plate: string; channel: Channel; pay: string; hours: number; rate: number | null; total: number; status: string; simulated: boolean };
  const simRows: Row[] = simScope.flatMap((l) => simulatedVisits({ lotId: l.id, lotName: l.name, city: l.city, category: l.category, count: 14, rules: { ...DEFAULT_RULES, ...((simRulesRows.find((r) => r.lot_id === l.id)?.rules as Partial<PricingRules>) ?? {}) } as PricingRules })).map((v) => ({ id: v.id, at: v.at, lotName: v.lotName, plate: v.plate, channel: v.channel, pay: v.pay, hours: v.duration_min / 60, rate: v.ratePaise, total: v.total_paise, status: v.status, simulated: true }));
  const realRows: Row[] = (data ?? []).map((r) => ({ id: r.id, at: r.arrival_at, lotName: (r.lots as unknown as { name: string } | null)?.name ?? "—", plate: "—", channel: "app" as Channel, pay: "upi", hours: r.duration_min / 60, rate: r.duration_min ? Math.round(r.total_paise / (r.duration_min / 60)) : null, total: r.total_paise, status: r.status, simulated: false }));
  const rows = [...realRows, ...simRows.filter((r) => status === "all" || r.status === status)].filter((r) => ch === "all" || r.channel === ch).sort((x, y) => y.at.localeCompare(x.at));
  const href = (o: { status?: string; lot?: string; ch?: string }) => `/operator/reservations?status=${o.status ?? status}${(o.lot ?? lotId) ? `&lot=${o.lot ?? lotId}` : ""}&ch=${o.ch ?? ch}`;
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
      {simRows.length > 0 && (
        <div className="chips" style={{ marginBottom: 14 }} role="group" aria-label={t("chCol")}>
          {([["all", t("catAll")], ["app", t("viaApp")], ["gate", t("atGate")]] as const).map(([k, label]) => <Link key={k} href={href({ ch: k })} className={k === ch ? "chip on" : "chip"}>{label}</Link>)}
        </div>
      )}
      <div className="card" data-testid="op-reservations">
        {simRows.length > 0 && <p style={{ marginTop: 0 }}><span className="pill demo">{t("simulatedBadge")}</span> <span className="muted">{t("simVisitsNote")}</span></p>}
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t("noBookingsYet")}</p> : (
          <div className="tblwrap"><table className="tbl" data-testid="sim-bookings">
            <thead><tr><th>{t("timeIn")}</th><th>{t("plateCol")}</th><th>{t("lotCol")}</th><th>{t("chCol")}</th><th>{t("payCol")}</th><th className="r">{t("hoursCol")}</th><th className="r">{t("rateCol")}</th><th className="r">{t("amountCol")}</th><th>{t("statusCol")}</th><th>{t("sourceCol")}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.at)}</td><td>{r.plate}</td><td>{r.lotName}</td>
                <td>{r.channel === "app" ? t("viaApp") : t("atGate")}</td>
                <td>{t(r.pay === "cash" ? "payCash" : r.pay === "fastag" ? "payFastag" : "payUpiM")}</td>
                <td className="r">{r.hours}</td><td className="r">{r.rate === null ? "—" : `${rupees(r.rate)}/h`}</td><td className="r">{rupees(r.total)}</td>
                <td><span className={`pill ${tone(r.status)}`}>{r.status.replace("_", " ")}</span></td>
                <td>{r.simulated ? <span className="pill demo">{t("srcSim")}</span> : <span className="pill green">{t("srcReal")}</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <p className="muted">{t("scannerNote")}</p>
    </main>
  );
}
