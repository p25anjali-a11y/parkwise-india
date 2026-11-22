"use client";
import { useEffect, useState } from "react";
import { freeRangeFromBays } from "../lib/availability-range";

type A = { available: false; reason: string } | { available: true; label: string; freeBays: { likely: number; pessimistic: number; optimistic: number }; pFull: number; stale: boolean; coldStart: boolean; modelVersion: string; simulated?: boolean };

export function AvailabilityAtArrival({ lotId, arrivalInMin }: { lotId: string; arrivalInMin: number }) {
  const [a, setA] = useState<A | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/availability?lotId=${lotId}&arrivalInMin=${arrivalInMin}`).then((r) => r.json()).then((j) => live && setA(j)).catch(() => live && setA(null));
    return () => {
      live = false;
    };
  }, [lotId, arrivalInMin]);
  if (!a) return null;
  if (!a.available) return <p data-testid="availability" className="muted">{a.reason}</p>;
  return (
    <p data-testid="availability" style={{ background: "var(--raise)", borderRadius: 14, padding: 12 }}>
      <strong>{a.label}</strong> when you arrive: about {freeRangeFromBays(a.freeBays.pessimistic, a.freeBays.optimistic).join("–")} bays free.
      {a.stale ? " Live count is stale, so this is less certain." : ""}{a.coldStart ? " New lot: limited history." : ""}
      <span className="muted" style={{ display: "block" }}>{a.simulated ? "Forecast, not a guarantee.*" : `Forecast, not a guarantee. Model ${a.modelVersion}, built from this lot's own recorded occupancy.`}</span>
    </p>
  );
}
