import Link from "next/link";
import { getLang } from "../../../lib/lang";
import { rupees } from "../../../lib/referral";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
const STATUSES = ["all", "held", "confirmed", "checked_in", "completed", "cancelled", "expired", "no_show"] as const;
const tone = (s: string) => (s === "confirmed" || s === "checked_in" || s === "completed" ? "green" : s === "held" ? "orange" : s === "no_show" ? "red" : "grey");

export default async function OperatorReservations({ searchParams }: { searchParams: Promise<{ status?: string; lot?: string }> }) {
  const { t } = await getLang();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "all";
  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name").order("name");
  const lotId = (lots ?? []).find((l) => l.id === sp.lot)?.id;
  let q = sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,created_at,lot_id,lots(name)").order("arrival_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("status", status as (typeof STATUSES)[number] & string);
  if (lotId) q = q.eq("lot_id", lotId);
  const { data } = await q;
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
        {(data ?? []).length === 0 ? <p className="muted" style={{ margin: 0 }}>{t("noBookingsYet")}</p> : (
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
