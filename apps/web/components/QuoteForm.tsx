"use client";
import { useState } from "react";
import { ReserveFlow } from "./ReserveFlow";
import { AvailabilityAtArrival } from "./AvailabilityAtArrival";
import { useT } from "./I18n";

type Q = { quoteId: string | null; total: number; ratePerHour: number; label: string; multiplier: number; overstayRatePerHour: number; breakdown: { label: string; multiplier: number }[]; occupancySource: string };

export function QuoteForm({ lotId }: { lotId: string }) {
  const { t, tl } = useT();
  const [arrive, setArrive] = useState(0);
  const [dur, setDur] = useState(120);
  const [q, setQ] = useState<Q | null>(null);
  const [err, setErr] = useState("");
  async function go() {
    setErr("");
    const r = await fetch(`/api/quote?lotId=${lotId}&arrivalInMin=${arrive}&durationMin=${dur}`);
    if (r.ok) setQ(await r.json());
    else setErr("Could not get a price right now.");
  }
  return (
    <section>
      <h2>{t("priceForStay")}</h2>
      <label className="f">{t("arriveIn")}<select value={arrive} onChange={(e) => setArrive(Number(e.target.value))}>{[0, 30, 60, 120, 240, 1440].map((m) => <option key={m} value={m}>{m === 0 ? t("now") : m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</select></label>
      <label className="f">{t("stay")}<select value={dur} onChange={(e) => setDur(Number(e.target.value))}>{[60, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m / 60} h</option>)}</select></label>
      <button onClick={go} className="btn blue block">{t("getPrice")}</button>
      <AvailabilityAtArrival lotId={lotId} arrivalInMin={arrive} />
      {q && (
        <div data-testid="quote" style={{ marginTop: 14 }}>
          <div className="rowb"><span className="price">₹{(q.total / 100).toFixed(0)} <small style={{ fontSize: 14 }}>{t("total")}</small></span><span className="pill demo">{tl(q.label)}</span></div>
          <p className="muted">₹{(q.ratePerHour / 100).toFixed(0)}/hr · Overstay: ₹{(q.overstayRatePerHour / 100).toFixed(0)}/hr</p>
          <ol className="steps">{q.breakdown.map((s, i) => <li key={i}><span>{s.label}</span><strong>{s.multiplier.toFixed(2)}x</strong></li>)}</ol>
          <p className="muted">Based on: {q.occupancySource}.</p>
          {q.quoteId ? <ReserveFlow key={q.quoteId} quoteId={q.quoteId} /> : <p className="muted">Reservations are not enabled on this deployment yet.</p>}
        </div>
      )}
      {err && <p role="alert" className="err">{err}</p>}
    </section>
  );
}
