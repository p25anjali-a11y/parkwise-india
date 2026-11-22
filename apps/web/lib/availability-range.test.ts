import { describe, expect, it } from "vitest";
import { freeRangeFromBays, fullRange } from "./availability-range";

describe("fullRange", () => {
  it("gives a 30-point window around the nearest 10% step", () => {
    expect(fullRange(0.46, 1000)).toEqual({ loPct: 30, hiPct: 60, freeLo: 400, freeHi: 700 });
  });
  it("clamps at both ends", () => {
    const low = fullRange(0.02, 500);
    expect(low.loPct).toBe(0);
    expect(low.freeHi).toBe(500);
    const high = fullRange(0.99, 500);
    expect(high.hiPct).toBe(100);
    expect(high.freeLo).toBe(0);
  });
  it("never shows an exact number: the free range is never a single value for a real lot", () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const r = fullRange(p, 800);
      expect(r.freeHi).toBeGreaterThan(r.freeLo);
    }
  });
  it("stays the same for small changes within a step", () => {
    expect(fullRange(0.41, 600)).toEqual(fullRange(0.49, 600));
  });
});

describe("freeRangeFromBays", () => {
  it("rounds to 5 and orders the pair", () => {
    expect(freeRangeFromBays(213, 148)).toEqual([150, 215]);
  });
});
