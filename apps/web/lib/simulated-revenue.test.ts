import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@parkwise/pricing";
import { simulatedDailyGross, simulatedVisits, sumDaily } from "./simulated-revenue";

const now = new Date("2026-11-22T12:00:00Z");
const base = { lotId: "lot-1", category: "mall", capacity: 800, rules: { ...DEFAULT_RULES, baseRatePerHour: 5000 }, days: 7, now };

describe("simulatedDailyGross", () => {
  it("returns one entry per day, oldest first, ending today (IST)", () => {
    const d = simulatedDailyGross(base);
    expect(d).toHaveLength(7);
    expect(d[6]!.day).toBe("2026-11-22");
    expect(d[0]!.day).toBe("2026-11-16");
  });
  it("is deterministic and integer paise", () => {
    const a = simulatedDailyGross(base);
    expect(simulatedDailyGross(base)).toEqual(a);
    for (const x of a) expect(Number.isInteger(x.paise)).toBe(true);
  });
  it("counts only hours that have already happened today", () => {
    const early = simulatedDailyGross({ ...base, now: new Date("2026-11-21T19:00:00Z") }); // 00:30 IST on the 22nd
    const late = simulatedDailyGross(base);
    expect(early[6]!.paise).toBeLessThan(late[6]!.paise);
  });
  it("earns more with more bays and a higher rate", () => {
    const small = simulatedDailyGross({ ...base, capacity: 100 })[3]!.paise;
    const big = simulatedDailyGross({ ...base, capacity: 800 })[3]!.paise;
    expect(big).toBeGreaterThan(small * 5);
  });
});

import { simulatedBookings, simulatedHourlyProfile, simulatedSummary } from "./simulated-revenue";

describe("simulated summary, profile and bookings", () => {
  it("summarises days into gross, bookings (2-hour stays) and average", () => {
    expect(simulatedSummary([{ paise: 200_000, bayHours: 40 }, { paise: 100_000, bayHours: 20 }])).toEqual({ grossPaise: 300_000, bookings: 30, avgPaise: 10_000 });
    expect(simulatedSummary([])).toEqual({ grossPaise: 0, bookings: 0, avgPaise: 0 });
  });
  it("gives 24 hourly occupancy fractions, busier in the evening than at 4am for a mall", () => {
    const p = simulatedHourlyProfile([{ id: "lot-1", category: "mall" }], 7, now);
    expect(p).toHaveLength(24);
    expect(p[19]!).toBeGreaterThan(p[4]!);
  });
  it("makes a deterministic list of bookings with integer paise and valid statuses", () => {
    const a = simulatedBookings({ ...base, lotName: "Test Mall", count: 8 });
    expect(a).toHaveLength(8);
    expect(simulatedBookings({ ...base, lotName: "Test Mall", count: 8 })).toEqual(a);
    for (const b of a) {
      expect(Number.isInteger(b.total_paise)).toBe(true);
      expect(["completed", "checked_in", "confirmed", "cancelled"]).toContain(b.status);
    }
  });
});

describe("channels and visits", () => {
  it("splits each day into app and gate that add up to the total", () => {
    for (const d of simulatedDailyGross(base)) {
      expect(d.appPaise + d.gatePaise).toBe(d.paise);
      expect(d.appVehicles + d.gateVehicles).toBe(Math.round(d.bayHours / 2));
    }
  });
  it("sums lots without losing the split", () => {
    const a = simulatedDailyGross(base), b = simulatedDailyGross({ ...base, lotId: "lot-2" });
    const s = sumDaily([a, b]);
    expect(s[2]!.paise).toBe(a[2]!.paise + b[2]!.paise);
    expect(s[2]!.appPaise + s[2]!.gatePaise).toBe(s[2]!.paise);
  });
  it("charges the same tier price at the gate and in the app, masks plates, and is deterministic", () => {
    const v = simulatedVisits({ lotId: "lot-1", lotName: "Mall", city: "Mumbai", category: "mall", rules: base.rules, count: 30, now });
    expect(simulatedVisits({ lotId: "lot-1", lotName: "Mall", city: "Mumbai", category: "mall", rules: base.rules, count: 30, now })).toEqual(v);
    expect(v.some((x) => x.channel === "app")).toBe(true);
    expect(v.some((x) => x.channel === "gate")).toBe(true);
    for (const x of v) {
      expect(x.total_paise).toBe(x.ratePaise * (x.duration_min / 60));
      expect(x.plate).toMatch(/^MH \d{2} [A-Z]\u2022 \d{4}$/);
      if (x.channel === "gate") expect(x.status).not.toBe("confirmed");
    }
  });
});
