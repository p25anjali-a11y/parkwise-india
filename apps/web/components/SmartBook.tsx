"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { freeRangeFromBays } from "../lib/availability-range";
import { arrivalInMin } from "../lib/trip-plan";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Plan = { etaMin: number; km: number; arrIn: number; arriveAt: string };
type Q = { quoteId: string | null; total: number; ratePerHour: number; label: string };
type Avail = { available: true; label: string; freeBays: { pessimistic: number; optimistic: number }; simulated?: boolean } | { available: false };

const STAYS = [60, 120, 180, 240];

/**
 * Automatic booking: uses your location to work out when you will arrive, then fills in the arrival time, checks the price and the
 * expected free spaces for that time, and books in one tap. The payment itself happens on the demo payment page.
 */
export function SmartBook({ lotId, autoStart }: { lotId: string; autoStart: boolean }) {
  const { t, tl } = useT();
  const [stay, setStay] = useState(120);
  const [phase, setPhase] = useState<"idle" | "locating" | "ready" | "booking">("idle");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [quote, setQuote] = useState<Q | null>(null);
  const [av, setAv] = useState<Avail | null>(null);
  const [err, setErr] = useState("");

  async function price(arrIn: number, durationMin: number) {
    setQuote(null);
    const r = await fetch(`/api/quote?lotId=${lotId}&arrivalInMin=${arrIn}&durationMin=${durationMin}`);
    if (!r.ok) throw new Error("quote");
    setQuote((await r.json()) as Q);
  }

  function start() {
    setErr(""); setPhase("locating");
    if (!navigator.geolocation) { setPhase("idle"); return setErr(t("locationDenied")); }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const er = await fetch(`/api/eta?lotId=${lotId}&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          if (!er.ok) throw new Error("eta");
          const eta = (await er.json()) as { minutes: number; km: number };
          const arrIn = arrivalInMin(eta.minutes);
          const arriveAt = new Date(Date.now() + arrIn * 60_000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
          setPlan({ etaMin: eta.minutes, km: eta.km, arrIn, arriveAt });
          const [, a] = await Promise.all([price(arrIn, stay), fetch(`/api/availability?lotId=${lotId}&arrivalInMin=${arrIn}`).then((x) => (x.ok ? x.json() : null))]);
          setAv(a as Avail | null);
          setPhase("ready");
        } catch {
          setPhase("idle");
          setErr(t("autoFailed"));
        }
      },
      () => { setPhase("idle"); setErr(t("locationDenied")); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }
  useEffect(() => { if (autoStart) start(); }, []); // eslint-disable-line

  async function changeStay(m: number) {
    setStay(m);
    if (plan) { try { await price(plan.arrIn, m); } catch { setErr(t("autoFailed")); } }
  }

  async function book() {
    if (!quote?.quoteId) return;
    setErr(""); setPhase("booking");
    const r = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.quoteId }) });
    if (r.status === 401) { window.location.href = `/login?next=${encodeURIComponent(`/lots/${lotId}?auto=1`)}`; return; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setPhase("ready"); return setErr(j.error ?? t("autoFailed")); }
    try { sessionStorage.setItem(`pw_pay_${j.reservation.id}`, JSON.stringify({ order: j.order, mock: j.mock })); } catch { /* the pay page explains if this is lost */ }
    window.location.href = `/pay/${j.reservation.id}`;
  }

  const [lo, hi] = av && av.available ? freeRangeFromBays(av.freeBays.pessimistic, av.freeBays.optimistic) : [0, 0];
  const maybeFull = av && av.available ? hi === 0 || av.label === "Nearly full" : false;
  return (
    <section data-testid="smart-book">
      <h2>{t("autoTitle")}</h2>
      {phase === "idle" || phase === "locating" ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>{t("autoSub")}</p>
          <button type="button" className="btn blue block" style={{ minHeight: 48 }} onClick={start} disabled={phase === "locating"}>{ICON.locate}&nbsp;{phase === "locating" ? t("autoLocating") : t("autoStart")}</button>
        </>
      ) : (
        plan && (
          <div className="smartplan">
            <div className="rowb"><span>{t("autoArrive", { time: plan.arriveAt, min: plan.etaMin })}</span><span className="muted">{plan.km} km</span></div>
            <div className="chips" role="group" aria-label={t("stay")} style={{ margin: "10px 0" }}>
              {STAYS.map((m) => <button key={m} type="button" className={m === stay ? "chip on" : "chip"} style={{ minHeight: 44 }} onClick={() => void changeStay(m)}>{m / 60} h</button>)}
            </div>
            {av && av.available && hi > 0 && <p style={{ margin: "0 0 6px" }}>{t("spacesThen", { lo, hi })}{av.simulated ? <> <span className="pill demo">{t("simulatedBadge")}</span></> : null}</p>}
            {maybeFull && <p role="alert" className="err" style={{ margin: "0 0 8px" }}>{t("autoMayBeFull")} <Link href="/search">{t("autoOther")}</Link></p>}
            {quote ? (
              <div className="rowb" style={{ margin: "8px 0 12px" }}>
                <span className="price">₹{(quote.total / 100).toFixed(0)} <small style={{ fontSize: 14 }}>{t("autoTotal", { h: stay / 60 })}</small></span>
                <span className="pill demo">{tl(quote.label)}</span>
              </div>
            ) : <p className="muted">…</p>}
            <button type="button" className="btn green block" style={{ minHeight: 48 }} onClick={() => void book()} disabled={!quote?.quoteId || phase === "booking"} data-testid="smart-book-go">
              {phase === "booking" ? t("autoBooking") : t("autoBook")}
            </button>
            {quote && !quote.quoteId && <p className="muted">{t("reservationsOff")}</p>}
          </div>
        )
      )}
      {err && <p role="alert" className="err">{err}</p>}
    </section>
  );
}
