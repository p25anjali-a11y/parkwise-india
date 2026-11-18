import { describe, expect, it } from "vitest";
import { hourlyProfile, pricingSummary, reservationSummary } from "./analytics";

describe("hourlyProfile", () => {
  it("averages by IST hour", () => {
    // 04:30Z = 10:00 IST
    const p = hourlyProfile([
      { captured_at: "2026-11-20T04:30:00Z", occupied: 50, capacity: 100 },
      { captured_at: "2026-11-21T04:45:00Z", occupied: 70, capacity: 100 },
    ]);
    expect(p[10]).toBe(0.6);
    expect(p[3]).toBeNull();
  });
  it("ignores zero-capacity rows", () => {
    expect(hourlyProfile([{ captured_at: "2026-11-20T04:30:00Z", occupied: 5, capacity: 0 }])[10]).toBeNull();
  });
});

describe("reservationSummary", () => {
  it("counts paid statuses as revenue and tracks conversion", () => {
    const s = reservationSummary([
      { status: "confirmed", total_paise: 10000, duration_min: 60 },
      { status: "completed", total_paise: 5000, duration_min: 60 },
      { status: "expired", total_paise: 9000, duration_min: 60 },
      { status: "held", total_paise: 7000, duration_min: 60 },
    ]);
    expect(s).toEqual({ reservations: 4, confirmed: 2, grossPaise: 15000, conversionPct: 50, cancelledOrExpired: 1 });
  });
  it("handles empty input", () => {
    expect(reservationSummary([]).conversionPct).toBeNull();
  });
});

describe("pricingSummary", () => {
  it("computes mean multiplier and peak share", () => {
    expect(pricingSummary([{ multiplier: 0.9 }, { multiplier: 1 }, { multiplier: 1.3 }, { multiplier: 1.5 }])).toEqual({ count: 4, meanMultiplier: 1.18, peakSharePct: 50 });
    expect(pricingSummary([]).meanMultiplier).toBeNull();
  });
});
