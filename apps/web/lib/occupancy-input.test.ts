import { describe, expect, it } from "vitest";
import { chooseOccupancy, type LiveRow } from "./occupancy-input";

const now = new Date("2026-11-19T10:00:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const live = (over: Partial<LiveRow> = {}): LiveRow => ({ occupied: 60, capacity: 100, updated_at: ago(5), source: "webhook", ...over });
const fc = (over = {}) => ({ target_time: now.toISOString(), p10: 50, p50: 70, p90: 80, p_full: 0.1, model_version: "baseline-v1", stale: false, cold_start: false, generated_at: ago(20), ...over });
const soon = new Date(now.getTime() + 15 * 60_000);

describe("chooseOccupancy", () => {
  it("prefers a fresh forecast", () => {
    const r = chooseOccupancy({ forecast: fc(), live: live(), arrival: soon, now });
    expect(r.value).toBe(0.7);
    expect(r.input.status).toBe("used");
  });
  it("falls back to a fresh live count for a soon arrival", () => {
    const r = chooseOccupancy({ forecast: null, live: live(), arrival: soon, now });
    expect(r.value).toBe(0.6);
    expect(r.modelVersion).toBe("live-count");
  });
  it("returns null when the live count is stale", () => {
    const r = chooseOccupancy({ forecast: null, live: live({ updated_at: ago(90) }), arrival: soon, now });
    expect(r.value).toBeNull();
    expect(r.input.status).toBe("stale");
  });
  it("does not price a far-off arrival from today's live count", () => {
    const r = chooseOccupancy({ forecast: null, live: live(), arrival: new Date(now.getTime() + 5 * 3600_000), now });
    expect(r.value).toBeNull();
  });
  it("ignores cold-start, stale or old forecasts", () => {
    for (const o of [{ cold_start: true }, { stale: true }, { generated_at: ago(400) }]) {
      expect(chooseOccupancy({ forecast: fc(o), live: live({ updated_at: ago(90) }), arrival: soon, now }).value).toBeNull();
    }
  });
  it("never uses synthetic rows", () => {
    expect(chooseOccupancy({ forecast: null, live: live({ is_synthetic: true }), arrival: soon, now }).value).toBeNull();
    expect(chooseOccupancy({ forecast: null, live: live({ source: "synthetic" }), arrival: soon, now }).value).toBeNull();
  });
  it("reports missing when there is no lot data at all", () => {
    expect(chooseOccupancy({ forecast: null, live: null, arrival: soon, now }).input.status).toBe("missing");
  });
});
