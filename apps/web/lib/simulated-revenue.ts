import { tierMultiplier, type PricingRules } from "@parkwise/pricing";
import { simulatedOccupancy } from "./simulated-occupancy";

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/**
 * SIMULATED daily gross for a demo lot: for every hour of each IST day, simulated occupied bays times the hourly rate
 * the lot's own tier table would charge at that occupancy. Computed on read, never stored, and always labelled as
 * simulated; real lots never use it (their revenue comes from real reservations).
 */
export function simulatedDailyGross(a: { lotId: string; category: string; capacity: number; rules: PricingRules; days: number; now?: Date }): { day: string; paise: number }[] {
  const now = a.now ?? new Date();
  const todayStart = Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const out: { day: string; paise: number }[] = [];
  for (let i = a.days - 1; i >= 0; i--) {
    const start = todayStart - i * DAY_MS;
    let paise = 0;
    for (let h = 0; h < 24; h++) {
      const at = new Date(start + h * 3_600_000);
      if (at.getTime() > now.getTime()) break; // no revenue for hours that have not happened yet
      const occ = simulatedOccupancy({ lotId: a.lotId, category: a.category, at });
      const m = Math.min(a.rules.ceilingMultiplier, Math.max(a.rules.floorMultiplier, tierMultiplier(a.rules.tiers, occ)));
      paise += occ * a.capacity * a.rules.baseRatePerHour * m;
    }
    out.push({ day: new Date(start + IST_MS).toISOString().slice(0, 10), paise: Math.round(paise) });
  }
  return out;
}
