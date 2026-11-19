export interface RatePoint { offsetMin: number; at: string; ratePerHour: number }

export type BestTime =
  | { kind: "already"; now: RatePoint }
  | { kind: "later"; now: RatePoint; best: RatePoint; savingPaise: number; savingPct: number };

/** Cheapest nearby hour. Suggests waiting only when it saves at least minSavingPct of the current hourly rate. */
export function suggestBest(points: RatePoint[], minSavingPct = 5): BestTime | null {
  const sorted = [...points].sort((a, b) => a.offsetMin - b.offsetMin);
  const now = sorted[0];
  if (!now) return null;
  let best = now;
  for (const p of sorted) if (p.ratePerHour < best.ratePerHour) best = p;
  const savingPaise = now.ratePerHour - best.ratePerHour;
  const savingPct = now.ratePerHour > 0 ? (savingPaise / now.ratePerHour) * 100 : 0;
  if (best === now || savingPct < minSavingPct) return { kind: "already", now };
  return { kind: "later", now, best, savingPaise, savingPct: Math.round(savingPct) };
}
