/** Helpers for "book for my trip": turn a drive time into an arrival slot, and rank lots for a driver. */

/** Minutes until arrival, rounded up to the next 5 (the quote and availability APIs work in 5-minute steps), plus a 5-minute buffer for parking and walking. */
export function arrivalInMin(etaMin: number): number {
  const withBuffer = Math.max(0, Math.round(etaMin)) + 5;
  return Math.min(24 * 60, Math.ceil(withBuffer / 5) * 5);
}

export interface Candidate { id: string; etaMin: number; freeHi: number; rate: number; label: string }

/** A lot is bookable for this trip when some space is expected and it is not flagged as nearly full. */
export function hasSpace(c: Pick<Candidate, "freeHi" | "label">): boolean {
  return c.freeHi > 0 && c.label !== "Nearly full";
}

/**
 * Lower is better. Lots with expected space come first; among them, the hour price (in rupees) and the drive time (in
 * minutes) count equally, with a small nudge towards more space.
 */
export function tripScore(c: Candidate): number {
  const rupees = c.rate / 100;
  const spaceBonus = Math.min(c.freeHi, 200) / 200; // 0..1
  return (hasSpace(c) ? 0 : 10_000) + rupees + c.etaMin - spaceBonus * 5;
}

export function rankForTrip<T extends Candidate>(list: T[]): T[] {
  return [...list].sort((a, b) => tripScore(a) - tripScore(b));
}
