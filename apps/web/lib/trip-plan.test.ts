import { describe, expect, it } from "vitest";
import { arrivalInMin, hasSpace, rankForTrip } from "./trip-plan";

describe("arrivalInMin", () => {
  it("adds a 5 minute buffer and rounds up to 5", () => {
    expect(arrivalInMin(0)).toBe(5);
    expect(arrivalInMin(22)).toBe(30);
    expect(arrivalInMin(20)).toBe(25);
  });
  it("never goes past 24 hours or below zero", () => {
    expect(arrivalInMin(99999)).toBe(1440);
    expect(arrivalInMin(-5)).toBe(5);
  });
});

describe("rankForTrip", () => {
  const base = { label: "Likely space" };
  it("puts lots with space ahead of full ones, even when the full one is closer and cheaper", () => {
    const r = rankForTrip([
      { id: "full", etaMin: 5, freeHi: 0, rate: 2000, label: "Nearly full" },
      { id: "ok", etaMin: 30, freeHi: 100, rate: 9000, ...base },
    ]);
    expect(r[0]!.id).toBe("ok");
  });
  it("balances price against drive time", () => {
    const r = rankForTrip([
      { id: "near-pricey", etaMin: 5, freeHi: 100, rate: 12000, ...base },
      { id: "far-cheap", etaMin: 40, freeHi: 100, rate: 3000, ...base },
      { id: "balanced", etaMin: 12, freeHi: 100, rate: 5000, ...base },
    ]);
    expect(r.map((x) => x.id)).toEqual(["balanced", "far-cheap", "near-pricey"]);
  });
  it("hasSpace is false when nothing is expected free", () => {
    expect(hasSpace({ freeHi: 0, label: "Likely space" })).toBe(false);
    expect(hasSpace({ freeHi: 20, label: "Likely space" })).toBe(true);
  });
});
