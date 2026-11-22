"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Order = { orderId: string; amountPaise: number };
type Props = { reservationId: string; lotId: string; lotName: string; totalPaise: number; holdExpiresAt: string; arrivalAt: string; durationMin: number; alreadyPaid: boolean };

const UPI = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

/** A DEMO payment page: looks like a UPI checkout, moves no money. The booking is confirmed through the same endpoints as the real flow. */
export function PayPortal(p: Props) {
  const { t } = useT();
  const [order, setOrder] = useState<Order | null>(null);
  const [upi, setUpi] = useState("demo@upi");
  const [stage, setStage] = useState<"form" | "waiting" | "done">(p.alreadyPaid ? "done" : "form");
  const [msg, setMsg] = useState("");
  const [left, setLeft] = useState(() => Math.max(0, Math.round((Date.parse(p.holdExpiresAt) - Date.now()) / 1000)));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`pw_pay_${p.reservationId}`);
      if (raw) setOrder((JSON.parse(raw) as { order: Order }).order);
      else if (!p.alreadyPaid) setMissing(true);
    } catch { setMissing(true); }
  }, [p.reservationId, p.alreadyPaid]);
  useEffect(() => {
    if (stage === "done") return;
    const id = setInterval(() => setLeft(Math.max(0, Math.round((Date.parse(p.holdExpiresAt) - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [p.holdExpiresAt, stage]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!order) return;
    if (!UPI.test(upi.trim())) return setMsg(t("payUpiBad"));
    setStage("waiting");
    await new Promise((r) => setTimeout(r, 2200)); // the "waiting for approval" moment
    const m = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.orderId }) });
    const mj = await m.json().catch(() => ({}));
    if (!m.ok) { setStage("form"); return setMsg(t("payFailed")); }
    const c = await fetch("/api/payments/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId: p.reservationId, orderId: order.orderId, paymentId: mj.paymentId, signature: mj.signature, method: "upi" }) });
    const cj = await c.json().catch(() => ({}));
    if (c.ok && (cj.result === "confirmed" || cj.result === "already")) { setStage("done"); try { sessionStorage.removeItem(`pw_pay_${p.reservationId}`); } catch { /* fine */ } return; }
    setStage("form");
    setMsg(cj.result === "refund_needed" ? t("payExpired") : t("payFailed"));
  }

  async function cancel() {
    await fetch("/api/reservations/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId: p.reservationId }) });
    window.location.href = `/lots/${p.lotId}`;
  }

  const amt = `₹${(p.totalPaise / 100).toFixed(0)}`;
  const arrival = new Date(p.arrivalAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  if (stage === "done") {
    return (
      <div className="card lift" data-testid="pay-done" style={{ textAlign: "center" }}>
        <div style={{ color: "var(--good)", display: "flex", justifyContent: "center", margin: "6px 0" }}>{ICON.check}</div>
        <h2>{t("payDone")}</h2>
        <p className="muted">{t("payDoneSub", { lot: p.lotName })}</p>
        <p><b>{amt}</b> · {arrival} · {p.durationMin / 60} h</p>
        <div style={{ display: "grid", gap: 8 }}>
          <Link href="/driver/reservations" className="btn green block" style={{ minHeight: 48 }}>{t("payViewTrips")}</Link>
          <Link href={`/trip/${p.lotId}`} className="btn block" style={{ minHeight: 48 }}>{ICON.nav}&nbsp;{t("startTrip")}</Link>
        </div>
      </div>
    );
  }
  if (missing || left === 0) {
    return <div className="card lift" role="alert"><p style={{ marginTop: 0 }}>{left === 0 ? t("payExpired") : t("payMissing")}</p><Link href={`/lots/${p.lotId}`} className="btn blue block">{p.lotName}</Link></div>;
  }
  return (
    <form onSubmit={pay} className="card lift" data-testid="pay-portal">
      <p className="pill demo" style={{ marginTop: 0 }}>{t("payDemoNote")}</p>
      <div className="rowb" style={{ margin: "10px 0" }}>
        <div><div className="muted">{t("payFor")}</div><strong>{p.lotName}</strong><div className="muted">{arrival} · {p.durationMin / 60} h</div></div>
        <span className="price">{amt}</span>
      </div>
      <p className="muted" style={{ margin: "0 0 12px" }}>{t("payHold", { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` })}</p>
      {stage === "waiting" ? (
        <div role="status" data-testid="pay-waiting" style={{ textAlign: "center", padding: "18px 0" }}>
          <div className="payspin" aria-hidden />
          <p>{t("payWaiting")}</p>
        </div>
      ) : (
        <>
          <label className="f">{t("payUpiId")}<input value={upi} onChange={(e) => setUpi(e.target.value)} autoCapitalize="none" autoCorrect="off" inputMode="email" aria-describedby="upi-help" /></label>
          <p id="upi-help" className="muted" style={{ marginTop: -6 }}>{t("payUpiHelp")}</p>
          <button type="submit" className="btn green block" style={{ minHeight: 48 }} disabled={!order}>{t("payPay", { amt })}</button>
          <p style={{ textAlign: "center", marginBottom: 0 }}><button type="button" className="chip" style={{ minHeight: 44 }} onClick={() => void cancel()}>{t("payCancel")}</button></p>
        </>
      )}
      {msg && <p role="alert" className="err">{msg}</p>}
    </form>
  );
}
