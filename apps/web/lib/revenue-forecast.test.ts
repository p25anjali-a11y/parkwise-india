import { describe, expect, it } from "vitest";
import { forecastRevenue } from "./revenue-forecast";

describe("forecastRevenue", () => {
  it("multiplies occupied spaces by rate and totals", () => {
    const r = forecastRevenue([{ at: "a", occupancy: 0.5, ratePerHour: 6000 }, { at: "b", occupancy: 1, ratePerHour: 9000 }], 100);
    expect(r.hours.map((h) => h.expectedPaise)).toEqual([300000, 900000]);
    expect(r.totalPaise).toBe(1200000);
  });
  it("clamps occupancy to 0..1", () => {
    expect(forecastRevenue([{ at: "a", occupancy: 2, ratePerHour: 100 }], 10).totalPaise).toBe(1000);
  });
});
