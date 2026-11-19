"use client";
import { useEffect, useState } from "react";

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
    <p data-testid="availability" style={{ background: "#232b4d", borderRadius: 14, padding: 12 }}>
      <strong>{a.label}</strong> when you arrive: about {a.freeBays.likely} bays free (range {a.freeBays.pessimistic}–{a.freeBays.optimistic}).
      {a.stale ? " Live count is stale, so this is less certain." : ""}{a.coldStart ? " New lot: limited history." : ""}
      <span className="muted" style={{ display: "block" }}>{a.simulated ? "SIMULATED data for demonstration, not a real forecast." : `Forecast, not a guarantee. Model ${a.modelVersion}, built from this lot's own recorded occupancy.`}</span>
    </p>
  );
}
