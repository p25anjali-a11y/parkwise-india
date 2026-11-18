import { describe, expect, it } from "vitest";
// Test-only synthetic fixture, deliberately not exported from the package.
import { demoCalendar, generateLot } from "../../../packages/forecast/src/synthetic";
import { flagsAt, planForecasts, type Context } from "./forecast-job";

const ctx: Context = {
  calendar: [
    { starts_on: "2026-11-20", ends_on: "2026-11-20", kind: "holiday", weight: 1 },
    { starts_on: "2026-11-21", ends_on: "2026-11-21", kind: "match", weight: 0.8 },
  ],
  events: [],
  rain: [{ kind: "rain_prob", value: 0.9, valid_at: "2026-11-22T06:30:00Z" }],
};

describe("flagsAt", () => {
  it("reads holiday, match and rain by IST date", () => {
    expect(flagsAt(Date.parse("2026-11-20T10:00:00Z"), ctx).holiday).toBe(true);
    expect(flagsAt(Date.parse("2026-11-21T10:00:00Z"), ctx).event).toBe(0.8);
    expect(flagsAt(Date.parse("2026-11-22T10:00:00Z"), ctx).rain).toBe(true);
    expect(flagsAt(Date.parse("2026-11-23T10:00:00Z"), ctx)).toEqual({});
  });
});

describe("planForecasts", () => {
  it("emits ordered, bounded rows on 15-minute steps from synthetic history", () => {
    const cal = demoCalendar();
    const samples = generateLot({ id: "11111111-1111-4111-8111-111111111111", category: "mall", capacity: 400 }, "2026-09-01", 21, cal, 3);
    const end = Math.max(...samples.map((s) => s.t));
    const snaps = samples.map((s) => ({ captured_at: new Date(s.t).toISOString(), occupied: s.occupied }));
    const now = new Date(end + 60_000);
    const rows = planForecasts([{ lotId: "11111111-1111-4111-8111-111111111111", category: "mall", capacity: 400, snapshots: snaps, live: { occupied: 200, asOf: now }, ctx: { calendar: [], events: [], rain: [] } }], now, 2);
    expect(rows.length).toBe(9);
    for (const r of rows) {
      expect(r.p10).toBeLessThanOrEqual(r.p50);
      expect(r.p50).toBeLessThanOrEqual(r.p90);
      expect(r.p90).toBeLessThanOrEqual(400);
      expect(r.p_full).toBeGreaterThanOrEqual(0);
      expect(r.p_full).toBeLessThanOrEqual(1);
    }
    expect(Date.parse(rows[1]!.target_time) - Date.parse(rows[0]!.target_time)).toBe(900_000);
  });
  it("skips lots with no history and no peers", () => {
    expect(planForecasts([{ lotId: "x", category: "office", capacity: 10, snapshots: [], ctx: { calendar: [], events: [], rain: [] } }], new Date(), 1)).toEqual([]);
  });
});
