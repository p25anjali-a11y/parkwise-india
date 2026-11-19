"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18n";

declare global {
  interface Window {
    Razorpay?: new (o: Record<string, unknown>) => { open(): void };
  }
}

type Order = { orderId: string; amountPaise: number; keyId?: string; isTest: boolean };
type Hold = { id: string; totalPaise: number; holdExpiresAt: string };

function loadCheckout(): Promise<void> {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("checkout failed to load"));
    document.body.appendChild(s);
  });
}

export function ReserveFlow({ quoteId }: { quoteId: string }) {
  const { t } = useT();
  const [hold, setHold] = useState<Hold | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [mock, setMock] = useState(true);
  const [msg, setMsg] = useState("");
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hold || done) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((Date.parse(hold.holdExpiresAt) - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [hold, done]);

  async function reserve() {
    setMsg("");
    const r = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId }) });
    if (r.status === 401) return (window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`);
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "Could not reserve.");
    setHold(j.reservation);
    setOrder(j.order);
    setMock(j.mock);
    setLeft(Math.round((Date.parse(j.reservation.holdExpiresAt) - Date.now()) / 1000));
  }

  async function confirm(paymentId: string, signature: string) {
    const r = await fetch("/api/payments/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId: hold!.id, orderId: order!.orderId, paymentId, signature, method: "upi" }) });
    const j = await r.json();
    if (r.ok && (j.result === "confirmed" || j.result === "already")) {
      setDone(true);
      setMsg("Reserved. Your bay is held for your arrival time.");
    } else if (j.result === "refund_needed") setMsg("Your hold had expired, so no space was reserved. A refund is needed; please contact support.");
    else setMsg(j.error ?? "Payment could not be confirmed.");
  }

  async function pay() {
    if (!hold || !order) return;
    if (mock) {
      const r = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.orderId }) });
      const j = await r.json();
      return confirm(j.paymentId, j.signature);
    }
    await loadCheckout();
    new window.Razorpay!({
      key: order.keyId, order_id: order.orderId, amount: order.amountPaise, currency: "INR", name: "Parkwise India",
      handler: (p: { razorpay_payment_id: string; razorpay_signature: string }) => confirm(p.razorpay_payment_id, p.razorpay_signature),
    }).open();
  }

  if (!hold) return <div><button onClick={reserve} className="btn green block">{t("reserve")}</button>{msg && <p role="alert" className="err">{msg}</p>}</div>;
  return (
    <div data-testid="hold">
      {!done && <p><strong>{t("held")} {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</strong>. Pay ₹{(hold.totalPaise / 100).toFixed(0)} to confirm.</p>}
      {!done && left > 0 && <button onClick={pay} className="btn green block">{t("payUpi")}{mock ? " (demo, no money moves)" : " (test mode)"}</button>}
      {!done && left === 0 && <p>Your hold expired. Get a new price to try again.</p>}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
