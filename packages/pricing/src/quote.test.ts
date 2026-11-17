import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, isLockValid, lockQuote, quote, settleStay, tierMultiplier, validateRules } from "./quote";
import type { PricingRules, QuoteInput } from "./types";

const t0 = new Date("2026-11-21T12:00:00Z");
const base = (over: Partial<QuoteInput> = {}, rules: Partial<PricingRules> = {}): QuoteInput => ({
  lotId: "lot1",
  zoneId: "z1",
  rules: { ...DEFAULT_RULES, ...rules },
  predictedOccupancy: 0.5,
  arrivalTime: t0,
  durationMin: 60,
  ...over,
});

describe("tierMultiplier", () => {
  it.each([
    [0, 0.9],
    [0.39, 0.9],
    [0.4, 1],
    [0.59, 1],
    [0.6, 1.15],
    [0.8, 1.3],
    [0.9, 1.5],
    [1, 1.5],
    [-1, 0.9],
    [5, 1.5],
  ])("occupancy %s -> %s", (occ, m) => {
    expect(tierMultiplier(DEFAULT_RULES.tiers, occ)).toBe(m);
  });

  it("works with unsorted tiers", () => {
    const tiers = [...DEFAULT_RULES.tiers].reverse();
    expect(tierMultiplier(tiers, 0.85)).toBe(1.3);
  });
});

describe("quote basics", () => {
  it("prices at base x tier and totals by duration", () => {
    const q = quote(base({ predictedOccupancy: 0.7 }));
    expect(q.multiplier).toBe(1.15);
    expect(q.ratePerHour).toBe(6900);
    expect(q.total).toBe(6900);
    expect(q.label).toBe("peak");
  });

  it("prorates 90 minutes", () => {
    const q = quote(base({ durationMin: 90, predictedOccupancy: 0.5 }));
    expect(q.total).toBe(9000);
  });

  it("labels off-peak and standard", () => {
    expect(quote(base({ predictedOccupancy: 0.1 })).label).toBe("off-peak");
    expect(quote(base({ predictedOccupancy: 0.5 })).label).toBe("standard");
  });

  it("is deterministic", () => {
    expect(quote(base())).toEqual(quote(base()));
  });

  it("breakdown starts at base and ends at the final multiplier", () => {
    const q = quote(base({ predictedOccupancy: 0.95 }));
    expect(q.breakdown[0]!.kind).toBe("base");
    expect(q.breakdown.at(-1)!.multiplier).toBe(q.multiplier);
  });

  it("rejects bad input", () => {
    expect(() => quote(base({ durationMin: 0 }))).toThrow();
    expect(() => quote(base({}, { baseRatePerHour: 0 }))).toThrow();
    expect(() => quote(base({}, { tiers: [] }))).toThrow();
    expect(() => quote(base({}, { floorMultiplier: 3 }))).toThrow();
    expect(() => validateRules({ ...DEFAULT_RULES, tiers: [{ minOccupancy: 0.2, multiplier: 1 }] })).toThrow();
  });
});

describe("signals and events", () => {
  it("adds rain and congestion uplifts, capped", () => {
    const q = quote(base({ signals: { rain: true, congestionIndex: 0.9 } }));
    expect(q.multiplier).toBe(1.1); // tier 1.0 + capped 0.10
  });

  it("caps total signal uplift", () => {
    const q = quote(
      base(
        { signals: { rain: true, congestionIndex: 1 } },
        { signalUplifts: { rain: 0.2, highCongestion: 0.2, congestionThreshold: 0.5 }, maxSignalUplift: 0.1 },
      ),
    );
    expect(q.multiplier).toBe(1.1);
  });

  it("ignores congestion below threshold", () => {
    expect(quote(base({ signals: { congestionIndex: 0.5 } })).multiplier).toBe(1);
  });

  it("applies event uplift", () => {
    const q = quote(base({}, { eventUplift: 0.25 }));
    expect(q.multiplier).toBe(1.25);
    expect(q.breakdown.some((s) => s.kind === "event")).toBe(true);
  });
});

describe("smoothing", () => {
  it("limits increases versus the previous multiplier", () => {
    const q = quote(base({ predictedOccupancy: 0.95, previousMultiplier: 1 }));
    expect(q.multiplier).toBe(1.15);
    expect(q.breakdown.some((s) => s.kind === "smoothing")).toBe(true);
  });

  it("limits decreases", () => {
    const q = quote(base({ predictedOccupancy: 0.1, previousMultiplier: 1.5 }));
    expect(q.multiplier).toBe(1.3);
  });

  it("does nothing within the limit", () => {
    const q = quote(base({ predictedOccupancy: 0.7, previousMultiplier: 1.1 }));
    expect(q.multiplier).toBe(1.15);
    expect(q.breakdown.some((s) => s.kind === "smoothing")).toBe(false);
  });

  it("converges to target over repeated intervals", () => {
    let prev = 1;
    for (let i = 0; i < 10; i++) prev = quote(base({ predictedOccupancy: 0.95, previousMultiplier: prev })).multiplier;
    expect(prev).toBe(1.5);
  });
});

describe("clamps and caps", () => {
  it("clamps to the ceiling multiplier", () => {
    const q = quote(base({ predictedOccupancy: 1 }, { ceilingMultiplier: 1.2 }));
    expect(q.multiplier).toBe(1.2);
    expect(q.breakdown.some((s) => s.kind === "clamp")).toBe(true);
  });

  it("clamps to the floor multiplier", () => {
    const q = quote(base({ predictedOccupancy: 0 }, { floorMultiplier: 1 }));
    expect(q.multiplier).toBe(1);
  });

  it("applies absolute rate bounds", () => {
    expect(quote(base({ predictedOccupancy: 1 }, { maxRatePerHour: 7000 })).ratePerHour).toBe(7000);
    expect(quote(base({ predictedOccupancy: 0 }, { minRatePerHour: 5800 })).ratePerHour).toBe(5800);
  });

  it("municipal cap wins over everything", () => {
    const q = quote(base({ predictedOccupancy: 1 }, { municipalCapPerHour: 6500, ceilingMultiplier: 3 }));
    expect(q.ratePerHour).toBe(6500);
    expect(q.breakdown.at(-1)!.kind).toBe("cap");
  });

  it("never exceeds the cap for any occupancy", () => {
    for (let o = 0; o <= 1.0001; o += 0.05) {
      const q = quote(base({ predictedOccupancy: o, signals: { rain: true, congestionIndex: 1 } }, { municipalCapPerHour: 7000, eventUplift: 0.5 }));
      expect(q.ratePerHour).toBeLessThanOrEqual(7000);
    }
  });

  it("is monotonic non-decreasing in occupancy", () => {
    let last = 0;
    for (let o = 0; o <= 1; o += 0.02) {
      const r = quote(base({ predictedOccupancy: o })).ratePerHour;
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });
});

describe("override and disabled", () => {
  it("manual override replaces computed multiplier with reason", () => {
    const q = quote(base({ predictedOccupancy: 0.95 }, { manualOverride: { multiplier: 1.05, reason: "festival goodwill" } }));
    expect(q.multiplier).toBe(1.05);
    expect(q.breakdown.some((s) => s.label.includes("festival goodwill"))).toBe(true);
  });

  it("override is still capped", () => {
    const q = quote(base({}, { manualOverride: { multiplier: 5, reason: "x" } }));
    expect(q.multiplier).toBe(2);
  });

  it("dynamic off keeps base price regardless of occupancy", () => {
    const q = quote(base({ predictedOccupancy: 1, signals: { rain: true } }, { dynamicEnabled: false }));
    expect(q.multiplier).toBe(1);
    expect(q.breakdown.some((s) => s.kind === "disabled")).toBe(true);
  });
});

describe("price lock", () => {
  it("lock expires after the hold window", () => {
    const l = lockQuote(quote(base()), t0, 15);
    expect(isLockValid(l, new Date(t0.getTime() + 14 * 60_000))).toBe(true);
    expect(isLockValid(l, new Date(t0.getTime() + 16 * 60_000))).toBe(false);
  });

  it("locked total never changes when a later quote is higher", () => {
    const locked = lockQuote(quote(base({ predictedOccupancy: 0.5 })), t0);
    const later = quote(base({ predictedOccupancy: 1 }));
    expect(later.total).toBeGreaterThan(locked.total);
    expect(settleStay(locked, 60)).toBe(locked.total);
  });

  it("overstay is billed at the disclosed overstay rate", () => {
    const locked = lockQuote(quote(base({ predictedOccupancy: 0.5 })), t0);
    expect(locked.overstayRatePerHour).toBe(9000);
    expect(settleStay(locked, 90)).toBe(6000 + 4500);
  });

  it("shorter stays do not increase the charge", () => {
    const locked = lockQuote(quote(base()), t0);
    expect(settleStay(locked, 20)).toBe(locked.total);
  });
});
