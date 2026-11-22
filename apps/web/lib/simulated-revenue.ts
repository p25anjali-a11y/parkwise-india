import { tierMultiplier, type PricingRules } from "@parkwise/pricing";
import { simulatedOccupancy } from "./simulated-occupancy";

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/**
 * SIMULATED daily gross for a demo lot: for every hour of each IST day, simulated occupied bays times the hourly rate
 * the lot's own tier table would charge at that occupancy. Computed on read, never stored, and always labelled as
 * simulated; real lots never use it (their revenue comes from real reservations).
 */
export function simulatedDailyGross(a: { lotId: string; category: string; capacity: number; rules: PricingRules; days: number; now?: Date }): { day: string; paise: number; bayHours: number }[] {
  const now = a.now ?? new Date();
  const todayStart = Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const out: { day: string; paise: number; bayHours: number }[] = [];
  for (let i = a.days - 1; i >= 0; i--) {
    const start = todayStart - i * DAY_MS;
    let paise = 0;
    let bayHours = 0;
    for (let h = 0; h < 24; h++) {
      const at = new Date(start + h * 3_600_000);
      if (at.getTime() > now.getTime()) break; // no revenue for hours that have not happened yet
      const occ = simulatedOccupancy({ lotId: a.lotId, category: a.category, at });
      const m = Math.min(a.rules.ceilingMultiplier, Math.max(a.rules.floorMultiplier, tierMultiplier(a.rules.tiers, occ)));
      paise += occ * a.capacity * a.rules.baseRatePerHour * m;
      bayHours += occ * a.capacity;
    }
    out.push({ day: new Date(start + IST_MS).toISOString().slice(0, 10), paise: Math.round(paise), bayHours: Math.round(bayHours) });
  }
  return out;
}

/** Totals for a run of simulated days. Bookings assume an average stay of two hours, so this is an estimate, not a count. */
export function simulatedSummary(daily: { paise: number; bayHours: number }[]): { grossPaise: number; bookings: number; avgPaise: number } {
  const grossPaise = daily.reduce((n, d) => n + d.paise, 0);
  const bookings = Math.round(daily.reduce((n, d) => n + d.bayHours, 0) / 2);
  return { grossPaise, bookings, avgPaise: bookings ? Math.round(grossPaise / bookings) : 0 };
}

/** Mean simulated occupancy by IST hour (0..23) across lots, for the "occupancy by hour" chart of demo lots. */
export function simulatedHourlyProfile(lots: { id: string; category: string }[], days = 7, now = new Date()): number[] {
  const todayStart = Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const out = new Array<number>(24).fill(0);
  if (lots.length === 0) return out;
  for (let h = 0; h < 24; h++) {
    let sum = 0, n = 0;
    for (let d = 1; d <= days; d++) {
      const at = new Date(todayStart - d * DAY_MS + h * 3_600_000);
      for (const l of lots) { sum += simulatedOccupancy({ lotId: l.id, category: l.category, at }); n++; }
    }
    out[h] = Math.round((sum / n) * 1000) / 1000;
  }
  return out;
}

export interface SimBooking { id: string; arrival_at: string; lotName: string; duration_min: number; total_paise: number; status: "completed" | "checked_in" | "confirmed" | "cancelled" }

/** A believable recent-bookings list for a demo lot (SIMULATED, deterministic for the hour). Never stored. */
export function simulatedBookings(a: { lotId: string; lotName: string; category: string; rules: PricingRules; count: number; now?: Date }): SimBooking[] {
  const now = a.now ?? new Date();
  const hourKey = Math.floor(now.getTime() / 3_600_000);
  const hash = (k: string) => { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; };
  const out: SimBooking[] = [];
  for (let i = 0; i < a.count; i++) {
    const r = hash(`${a.lotId}:${hourKey}:${i}`);
    const minsAgo = Math.round(i * 41 + r * 30 - 90); // a few are still to arrive
    const arrival = new Date(now.getTime() - minsAgo * 60_000);
    const hours = 1 + Math.floor(hash(`${a.lotId}:${i}:d`) * 4);
    const occ = simulatedOccupancy({ lotId: a.lotId, category: a.category, at: arrival });
    const m = Math.min(a.rules.ceilingMultiplier, Math.max(a.rules.floorMultiplier, tierMultiplier(a.rules.tiers, occ)));
    const cancelled = hash(`${a.lotId}:${i}:c`) < 0.08;
    const status: SimBooking["status"] = cancelled ? "cancelled" : minsAgo < 0 ? "confirmed" : minsAgo < hours * 60 ? "checked_in" : "completed";
    out.push({ id: `sim-${a.lotId.slice(0, 6)}-${hourKey}-${i}`, arrival_at: arrival.toISOString(), lotName: a.lotName, duration_min: hours * 60, total_paise: Math.round(a.rules.baseRatePerHour * m) * hours, status });
  }
  return out;
}
