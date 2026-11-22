/**
 * Drivers see how full a lot is as a range, never an exact count: exact in/out movements are the operator's information.
 * The range is a 30-point window placed on the nearest 10% step, so it stays steady between refreshes and only moves when
 * the lot really changes.
 */
export interface FullRange { loPct: number; hiPct: number; freeLo: number; freeHi: number }

const round5 = (n: number) => Math.round(n / 5) * 5;

export function fullRange(occupancy: number, capacity: number): FullRange {
  const p = Math.min(1, Math.max(0, occupancy));
  const step = Math.min(9, Math.floor(p * 10));
  const loPct = Math.max(0, (step - 1) * 10);
  const hiPct = Math.min(100, (step + 2) * 10);
  const cap = Math.max(0, capacity);
  const freeLo = Math.max(0, round5(cap * (1 - hiPct / 100)));
  const freeHi = Math.min(round5(cap), Math.max(freeLo, round5(cap * (1 - loPct / 100))));
  return { loPct, hiPct, freeLo, freeHi };
}

/** Rounds a pair of bay counts the same way, for the forecast text on the arrival card. */
export function freeRangeFromBays(a: number, b: number): [number, number] {
  const lo = Math.max(0, round5(Math.min(a, b)));
  const hi = Math.max(lo, round5(Math.max(a, b)));
  return [lo, hi];
}
