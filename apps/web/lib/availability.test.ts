import { describe, expect, it } from "vitest";
import { describeForecast, nearestForecast, type ForecastRow } from "./availability";

const row = (iso: string, p10 = 100, p50 = 150, p90 = 200, p_full = 0.01): ForecastRow => ({ target_time: iso, p10, p50, p90, p_full, model_version: "m", stale: false, cold_start: false });

describe("availability", () => {
  const rows = [row("2026-11-20T10:00:00Z"), row("2026-11-20T10:15:00Z"), row("2026-11-20T10:30:00Z")];
  it("picks the nearest row within tolerance", () => {
    expect(nearestForecast(rows, new Date("2026-11-20T10:16:00Z"))?.target_time).toBe("2026-11-20T10:15:00Z");
  });
  it("returns null outside tolerance", () => {
    expect(nearestForecast(rows, new Date("2026-11-20T12:00:00Z"))).toBeNull();
  });
  it("derives free bays from occupancy quantiles", () => {
    const d = describeForecast(row("x", 100, 150, 200), 400);
    expect(d.freeBays).toEqual({ likely: 250, pessimistic: 200, optimistic: 300 });
    expect(d.label).toBe("Likely space");
  });
  it("calls a nearly full lot probably full", () => {
    expect(describeForecast(row("x", 395, 399, 400, 0.9), 400).label).toBe("Probably full");
  });
});
