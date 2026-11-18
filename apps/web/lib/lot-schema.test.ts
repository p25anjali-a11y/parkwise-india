import { describe, expect, it } from "vitest";
import { lotInput, rulesInput, rupeesToPaise } from "./lot-schema";

describe("lot input", () => {
  const ok = { name: "Test Lot", city: "Mumbai", category: "mall", lat: 19.1, lng: 72.8, carCapacity: "300", reservablePct: "20", baseRupeesPerHour: "60" };
  it("coerces form strings", () => {
    const p = lotInput.parse(ok);
    expect(p.carCapacity).toBe(300);
  });
  it("rejects bad city, coordinates and capacity", () => {
    expect(lotInput.safeParse({ ...ok, city: "Delhi" }).success).toBe(false);
    expect(lotInput.safeParse({ ...ok, lat: 200 }).success).toBe(false);
    expect(lotInput.safeParse({ ...ok, carCapacity: 0 }).success).toBe(false);
  });
  it("keeps money in whole paise", () => {
    expect(rupeesToPaise(59.99)).toBe(5999);
    expect(rupeesToPaise(60)).toBe(6000);
  });
  it("bounds the multiplier range", () => {
    expect(rulesInput.safeParse({ baseRupeesPerHour: 60, floorMultiplier: 0.1, ceilingMultiplier: 2, dynamicEnabled: true }).success).toBe(false);
  });
});
