"use client";
import { useState } from "react";
import { AvailabilityAtArrival } from "./AvailabilityAtArrival";

type Q = { total: number; ratePerHour: number; label: string; multiplier: number; overstayRatePerHour: number; breakdown: { label: string; multiplier: number }[]; occupancySource: string };

export function QuoteForm({ lotId }: { lotId: string }) {
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
      <h2>Price for your stay</h2>
      <label>Arrive in <select value={arrive} onChange={(e) => setArrive(Number(e.target.value))}>{[0, 30, 60, 120, 240, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "now" : m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</select></label>{" "}
      <label>Stay <select value={dur} onChange={(e) => setDur(Number(e.target.value))}>{[60, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m / 60} h</option>)}</select></label>{" "}
      <button onClick={go}>Get price</button>
      <AvailabilityAtArrival lotId={lotId} arrivalInMin={arrive} />
      {q && (
        <div data-testid="quote">
          <p><strong>₹{(q.total / 100).toFixed(0)}</strong> total (₹{(q.ratePerHour / 100).toFixed(0)}/hr, {q.label}). Overstay: ₹{(q.overstayRatePerHour / 100).toFixed(0)}/hr.</p>
          <ol>{q.breakdown.map((s, i) => <li key={i}>{s.label}: {s.multiplier.toFixed(2)}x</li>)}</ol>
          <p style={{ fontSize: 13, color: "#555" }}>Based on the {q.occupancySource}.</p>
        </div>
      )}
      {err && <p role="alert">{err}</p>}
    </section>
  );
}
