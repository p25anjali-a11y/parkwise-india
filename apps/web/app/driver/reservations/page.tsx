import { supabaseServer } from "../../../lib/supabase/server";
import QRCode from "qrcode";
import { signPass } from "../../../lib/pass";
import { CarPin } from "../../../components/CarPin";
import { ValetButton } from "../../../components/ValetButton";
import { getLang } from "../../../lib/lang";

export const dynamic = "force-dynamic";

export default async function Reservations() {
  const { t } = await getLang();
  const sb = await supabaseServer();
  const { data } = await sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,hold_expires_at,lots(name)").order("created_at", { ascending: false }).limit(50);
  const ids = (data ?? []).map((r) => r.id);
  const { data: pins } = await sb.from("car_pins").select("reservation_id,note,lat,lng").in("reservation_id", ids);
  const { data: valets } = await sb.from("valet_requests").select("id,reservation_id,status").in("reservation_id", ids);
  const pinBy = new Map((pins ?? []).map((x) => [x.reservation_id, x]));
  const valetBy = new Map((valets ?? []).map((x) => [x.reservation_id, x]));
  const secret = process.env.CRON_SECRET;
  const qr = new Map<string, string>();
  if (secret) for (const r of data ?? []) if (r.status === "confirmed") qr.set(r.id, await QRCode.toString(signPass(r.id, secret), { type: "svg", margin: 1, color: { dark: "#1d2340", light: "#ffffff" } }));
  return (
    <main className="shell">
      <div className="top"><h1>🎟️ {t("myReservations")}</h1></div>
      <div className="lift">
        {(data ?? []).length === 0 && <div className="card">{t("noReservations")}</div>}
        {(data ?? []).map((r) => (
          <div className="card" key={r.id}>
            <div className="rowb"><h3 style={{ margin: 0 }}>{(r.lots as unknown as { name: string } | null)?.name ?? "Lot"}</h3><span className="price">₹{(r.total_paise / 100).toFixed(0)}</span></div>
            <div className="muted">{new Date(r.arrival_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {r.duration_min / 60} h</div>
            {qr.has(r.id) && (
              <div style={{ margin: "12px 0", textAlign: "center" }} data-testid="entry-pass">
                <strong>🎫 {t("entryPass")}</strong>
                <div style={{ width: 180, margin: "8px auto", borderRadius: 12, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: qr.get(r.id)! }} />
                <div className="muted">{t("passHint")}</div>
              </div>
            )}
            {r.status === "confirmed" && (
              <>
                <CarPin reservationId={r.id} note={pinBy.get(r.id)?.note} lat={pinBy.get(r.id)?.lat} lng={pinBy.get(r.id)?.lng} />
                <ValetButton reservationId={r.id} valet={valetBy.get(r.id) ?? null} />
              </>
            )}
            <span className={`pill ${r.status === "confirmed" ? "green" : r.status === "held" ? "orange" : "grey"}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
