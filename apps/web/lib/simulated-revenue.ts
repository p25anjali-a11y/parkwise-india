import { tierMultiplier, type PricingRules } from "@parkwise/pricing";
import { simulatedOccupancy } from "./simulated-occupancy";

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const hash01 = (k: string) => { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; };
/** Share of vehicles that booked through the app (the rest pay at the gate): 28 to 42 percent, steady per lot and day. */
export function appShare(lotId: string, day: string): number { return 0.28 + hash01(`${lotId}:${day}:app`) * 0.14; }

/**
 * SIMULATED daily gross for a demo lot: for every hour of each IST day, simulated occupied bays times the hourly rate
 * the lot's own tier table would charge at that occupancy. Computed on read, never stored, and always labelled as
 * simulated; real lots never use it (their revenue comes from real reservations).
 */
export function simulatedDailyGross(a: { lotId: string; category: string; capacity: number; rules: PricingRules; days: number; now?: Date }): { day: string; paise: number; bayHours: number; mult: number; appPaise: number; gatePaise: number; appVehicles: number; gateVehicles: number }[] {
  const now = a.now ?? new Date();
  const todayStart = Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const out: ReturnType<typeof simulatedDailyGross> = [];
  for (let i = a.days - 1; i >= 0; i--) {
    const start = todayStart - i * DAY_MS;
    let paise = 0;
    let bayHours = 0;
    let weighted = 0;
    for (let h = 0; h < 24; h++) {
      const at = new Date(start + h * 3_600_000);
      if (at.getTime() > now.getTime()) break; // no revenue for hours that have not happened yet
      const occ = simulatedOccupancy({ lotId: a.lotId, category: a.category, at });
      const m = Math.min(a.rules.ceilingMultiplier, Math.max(a.rules.floorMultiplier, tierMultiplier(a.rules.tiers, occ)));
      paise += occ * a.capacity * a.rules.baseRatePerHour * m;
      bayHours += occ * a.capacity;
      weighted += occ * a.capacity * m;
    }
    const day = new Date(start + IST_MS).toISOString().slice(0, 10);
    const share = appShare(a.lotId, day);
    const vehicles = Math.round(bayHours / 2);
    const appPaise = Math.round(paise * share);
    out.push({ day, paise: Math.round(paise), bayHours: Math.round(bayHours), mult: bayHours ? Math.round((weighted / bayHours) * 100) / 100 : 0, appPaise, gatePaise: Math.round(paise) - appPaise, appVehicles: Math.round(vehicles * share), gateVehicles: vehicles - Math.round(vehicles * share) });
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

/** Add several lots' simulated days together (same day order). */
export function sumDaily(list: ReturnType<typeof simulatedDailyGross>[]): ReturnType<typeof simulatedDailyGross> {
  if (list.length === 0) return [];
  return list.reduce((acc, d) => acc.map((x, i) => {
    const y = d[i]!;
    const bh = x.bayHours + y.bayHours;
    return { day: x.day, paise: x.paise + y.paise, bayHours: bh, mult: bh ? Math.round(((x.mult * x.bayHours + y.mult * y.bayHours) / bh) * 100) / 100 : 0, appPaise: x.appPaise + y.appPaise, gatePaise: x.gatePaise + y.gatePaise, appVehicles: x.appVehicles + y.appVehicles, gateVehicles: x.gateVehicles + y.gateVehicles };
  }));
}

export type Channel = "app" | "gate";
export type PayMethod = "upi" | "cash" | "fastag";
export interface SimVisit { id: string; at: string; lotName: string; plate: string; channel: Channel; pay: PayMethod; duration_min: number; ratePaise: number; total_paise: number; status: "confirmed" | "checked_in" | "completed" | "cancelled" }

const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
/** A made-up plate, masked in the middle. Never a real vehicle. */
function plateFor(k: string, city: string): string {
  const l = (n: number) => LETTERS[Math.floor(hash01(`${k}:l${n}`) * LETTERS.length)]!;
  return `${city === "Ahmedabad" ? "GJ" : "MH"} ${String(1 + Math.floor(hash01(`${k}:n`) * 47)).padStart(2, "0")} ${l(1)}\u2022 ${1000 + Math.floor(hash01(`${k}:d`) * 9000)}`;
}

/**
 * SIMULATED vehicle visits for a demo lot: some booked in the app, most paid at the gate. Both pay the same Parkwise
 * dynamic price (the tier price for the occupancy at the time of arrival). Deterministic for the hour, never stored.
 */
export function simulatedVisits(a: { lotId: string; lotName: string; city: string; category: string; rules: PricingRules; count: number; now?: Date }): SimVisit[] {
  const now = a.now ?? new Date();
  const hourKey = Math.floor(now.getTime() / 3_600_000);
  const out: SimVisit[] = [];
  for (let i = 0; i < a.count; i++) {
    const k = `${a.lotId}:${hourKey}:${i}`;
    const raw = Math.round(i * 23 + hash01(k) * 18 - 45);
    const channel: Channel = hash01(`${k}:ch`) < 0.35 ? "app" : "gate";
    const minsAgo = channel === "gate" ? Math.abs(raw) : raw; // only app bookings can still be to come; gate vehicles are already in
    const at = new Date(now.getTime() - minsAgo * 60_000);
    const hours = 1 + Math.floor(hash01(`${a.lotId}:${i}:d`) * 4);
    const occ = simulatedOccupancy({ lotId: a.lotId, category: a.category, at });
    const m = Math.min(a.rules.ceilingMultiplier, Math.max(a.rules.floorMultiplier, tierMultiplier(a.rules.tiers, occ)));
    const ratePaise = Math.round(a.rules.baseRatePerHour * m);
    const r = hash01(`${k}:pay`);
    const pay: PayMethod = channel === "app" ? "upi" : r < 0.45 ? "upi" : r < 0.75 ? "fastag" : "cash";
    const cancelled = channel === "app" && hash01(`${k}:c`) < 0.1;
    const status: SimVisit["status"] = cancelled ? "cancelled" : minsAgo < 0 ? "confirmed" : minsAgo < hours * 60 ? "checked_in" : "completed";
    out.push({ id: `sim-${a.lotId.slice(0, 6)}-${hourKey}-${i}`, at: at.toISOString(), lotName: a.lotName, plate: plateFor(k, a.city), channel, pay, duration_min: hours * 60, ratePaise, total_paise: ratePaise * hours, status });
  }
  return out;
}
