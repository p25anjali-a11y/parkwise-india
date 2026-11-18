import { describe, expect, it } from "vitest";
import { availabilityNow, CITY_CENTRES, haversineKm, sortByDistance } from "./geo";

describe("geo", () => {
  it("measures Mumbai to Ahmedabad at roughly 440 km", () => {
    const d = haversineKm(CITY_CENTRES.Mumbai!, CITY_CENTRES.Ahmedabad!);
    expect(d).toBeGreaterThan(420);
    expect(d).toBeLessThan(460);
  });
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
  });
  it("sorts nearest first", () => {
    const from = { lat: 19.0, lng: 72.8 };
    const r = sortByDistance([{ lat: 19.5, lng: 72.8, n: "far" }, { lat: 19.01, lng: 72.8, n: "near" }], from);
    expect(r[0]!.n).toBe("near");
  });
  it("labels availability by occupancy", () => {
    expect(availabilityNow(10, 100)).toBe("Likely space");
    expect(availabilityNow(80, 100)).toBe("Tight");
    expect(availabilityNow(95, 100)).toBe("Nearly full");
    expect(availabilityNow(0, 0)).toBe("Nearly full");
  });
});
