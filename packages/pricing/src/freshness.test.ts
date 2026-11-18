import { describe, expect, it } from "vitest";
import { isFresh } from "./freshness";
import { quote, DEFAULT_RULES } from "./quote";

const now = new Date("2026-11-19T10:00:00Z");
const min = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("isFresh", () => {
  it("accepts data inside the limit and rejects older data", () => {
    expect(isFresh("occupancy", min(29), now)).toBe(true);
    expect(isFresh("occupancy", min(31), now)).toBe(false);
    expect(isFresh("weather", min(120), now)).toBe(true);
    expect(isFresh("weather", min(200), now)).toBe(false);
  });
  it("treats missing, invalid and future timestamps as not fresh", () => {
    expect(isFresh("traffic", null, now)).toBe(false);
    expect(isFresh("traffic", "not a date", now)).toBe(false);
    expect(isFresh("traffic", min(-30), now)).toBe(false);
  });
});

describe("quote without occupancy data", () => {
  const base = { lotId: "l", zoneId: "z", rules: DEFAULT_RULES, arrivalTime: now, durationMin: 60 };
  it("stays at the base tariff and says why", () => {
    const q = quote({ ...base, predictedOccupancy: null });
    expect(q.predictedOccupancy).toBeNull();
    expect(q.multiplier).toBe(1);
    expect(q.ratePerHour).toBe(DEFAULT_RULES.baseRatePerHour);
    expect(q.breakdown.some((s) => s.kind === "no_data")).toBe(true);
  });
  it("still applies fresh signals", () => {
    const q = quote({ ...base, predictedOccupancy: null, signals: { rain: true } });
    expect(q.multiplier).toBe(1.05);
  });
  it("records the inputs it was given", () => {
    const inputs = [{ name: "occupancy" as const, status: "missing" as const }];
    expect(quote({ ...base, predictedOccupancy: null, inputs }).inputs).toEqual(inputs);
  });
});
