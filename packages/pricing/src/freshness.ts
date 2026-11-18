/** Real-data freshness limits, in minutes. Older data is treated as missing, never used. */
export const MAX_AGE_MIN = {
  /** Live occupancy count from a partner feed or our own bookings. */
  occupancy: 30,
  /** Traffic flow near the lot. */
  traffic: 30,
  /** Weather forecast fetch. */
  weather: 180,
  /** A stored occupancy forecast, judged on when it was generated. */
  forecast: 180,
} as const;

export type FreshnessKind = keyof typeof MAX_AGE_MIN;

/** True when asOf is within the limit for this kind of data. A missing or future timestamp is not fresh. */
export function isFresh(kind: FreshnessKind, asOf: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!asOf) return false;
  const t = new Date(asOf).getTime();
  if (Number.isNaN(t)) return false;
  const ageMin = (now.getTime() - t) / 60_000;
  return ageMin >= -1 && ageMin <= MAX_AGE_MIN[kind];
}
