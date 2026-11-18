import type { DayFlags, LotCategory, Sample } from "./types";
import { STEP_MS, istMidnight, istParts } from "./time";

/** TEST FIXTURE ONLY. All data produced here is SYNTHETIC and is not exported from the package or used by the app. */
export const SYNTHETIC = true;

export interface LotSpec {
  id: string;
  category: LotCategory;
  capacity: number;
}

export type Calendar = (dateKey: string, dayIndex: number) => DayFlags;

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const bump = (h: number, mu: number, sd: number, amp: number) => amp * Math.exp(-((h - mu) ** 2) / (2 * sd * sd));

function baseShape(cat: LotCategory, h: number, weekendLike: boolean, event: boolean): number {
  switch (cat) {
    case "mall":
      return weekendLike
        ? 0.08 + bump(h, 13, 2.5, 0.5) + bump(h, 18.5, 2.2, 0.55)
        : 0.06 + bump(h, 13, 2.5, 0.28) + bump(h, 19, 2, 0.4);
    case "office":
      return weekendLike ? 0.06 + bump(h, 12, 3, 0.06) : 0.08 + bump(h, 12, 3.6, 0.82);
    case "hospital":
      return weekendLike ? 0.3 + bump(h, 11, 3, 0.25) : 0.3 + bump(h, 11, 3.2, 0.45);
    case "stadium":
      return 0.04 + (event ? bump(h, 18.5, 1.7, 0.85) : 0);
  }
}

/**
 * Generate `days` days of 15-minute occupancy for one lot starting at `startDate`
 * (YYYY-MM-DD, IST). Patterns: weekday/weekend, holiday and festival (weekend-like,
 * offices quiet), event days (stadium match, small mall uplift) and rain days.
 */
export function generateLot(spec: LotSpec, startDate: string, days: number, calendar: Calendar, seed: number): Sample[] {
  const r = rng(seed);
  const start = istMidnight(startDate);
  const out: Sample[] = [];
  let ar = 0;
  for (let d = 0; d < days; d++) {
    const dayStart = start + d * 86_400_000;
    const key = istParts(dayStart).dateKey;
    const flags = calendar(key, d);
    const dow = istParts(dayStart).dow;
    const weekendLike = dow >= 5 || !!flags.holiday || !!flags.festival;
    const dayLevel = 1 + 0.05 * normal(r);
    for (let s = 0; s < 96; s++) {
      const t = dayStart + s * STEP_MS;
      const h = s / 4;
      let f = baseShape(spec.category, h, weekendLike, !!flags.event);
      if (flags.event && spec.category === "mall") f += bump(h, 19, 2, 0.12);
      if (flags.festival && spec.category === "mall") f += bump(h, 18, 2.5, 0.15);
      if (flags.holiday && spec.category === "hospital") f *= 0.9;
      if (flags.rain) {
        if (spec.category === "mall") f -= bump(h, 16, 4, 0.12);
        if (spec.category === "office") f -= 0.05;
        if (spec.category === "hospital") f += 0.04;
      }
      ar = 0.9 * ar + 0.04 * normal(r);
      f = f * dayLevel + ar;
      const occupied = Math.min(spec.capacity, Math.max(0, Math.round(f * spec.capacity)));
      out.push({ t, occupied, flags });
    }
  }
  return out;
}

/** Default 60-day calendar used by the backtest and (later) the seed script. */
export function demoCalendar(): Calendar {
  const festival = new Set([12, 33, 47]);
  const holiday = new Set([20, 38]);
  const match = new Set([9, 23, 41, 52]);
  const rain = new Set([5, 6, 18, 30, 31, 44, 56]);
  return (_key, d) => ({
    festival: festival.has(d) || undefined,
    holiday: holiday.has(d) || undefined,
    event: match.has(d) ? 1 : undefined,
    rain: rain.has(d) || undefined,
  });
}
