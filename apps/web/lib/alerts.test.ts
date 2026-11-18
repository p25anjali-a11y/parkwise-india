import { describe, expect, it } from "vitest";
import { computeAlerts, type AlertInput } from "./alerts";

const now = new Date("2026-11-20T10:00:00Z");
const base: AlertInput = { lotId: "l", lotName: "Lot", occupied: 50, capacity: 100, lastFeedAt: "2026-11-20T09:58:00Z", maxPFullNext2h: 0.1 };

describe("computeAlerts", () => {
  it("is quiet for a healthy lot", () => {
    expect(computeAlerts([base], now)).toEqual([]);
  });
  it("flags nearly full with severity by level", () => {
    expect(computeAlerts([{ ...base, occupied: 92 }], now)[0]).toMatchObject({ kind: "nearly_full", severity: "warning" });
    expect(computeAlerts([{ ...base, occupied: 99 }], now)[0]).toMatchObject({ kind: "nearly_full", severity: "critical" });
  });
  it("flags stale and missing feeds", () => {
    expect(computeAlerts([{ ...base, lastFeedAt: "2026-11-20T09:30:00Z" }], now)[0]).toMatchObject({ kind: "feed_stale", severity: "warning" });
    expect(computeAlerts([{ ...base, lastFeedAt: "2026-11-20T08:00:00Z" }], now)[0]).toMatchObject({ kind: "feed_stale", severity: "critical" });
    expect(computeAlerts([{ ...base, lastFeedAt: null }], now)[0]).toMatchObject({ kind: "no_feed", severity: "info" });
  });
  it("flags forecast full and price ceiling", () => {
    const a = computeAlerts([{ ...base, maxPFullNext2h: 0.6, atCeiling: true }], now);
    expect(a.map((x) => x.kind).sort()).toEqual(["forecast_full", "price_at_ceiling"]);
  });
  it("sorts critical first", () => {
    const a = computeAlerts([{ ...base, lotName: "A", lastFeedAt: null }, { ...base, lotName: "B", occupied: 99 }], now);
    expect(a[0]!.severity).toBe("critical");
    expect(a[a.length - 1]!.severity).toBe("info");
  });
  it("handles lots with no live count", () => {
    expect(computeAlerts([{ ...base, occupied: null, capacity: null }], now)).toEqual([]);
  });
});
