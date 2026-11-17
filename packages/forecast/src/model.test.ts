import { describe, expect, it } from "vitest";
import { BaselineForecastService, fitModel, forecastWithModel, normCdf, confidenceLabel } from "./model";
import { demoCalendar, generateLot, rng } from "./synthetic";
import { hourOfWeek, istMidnight, istParts } from "./time";
import { checkThresholds, runBacktest } from "./backtest";
import thresholds from "../thresholds.json";

const spec = { id: "m1", category: "mall" as const, capacity: 500 };
const data = generateLot(spec, "2026-09-01", 42, demoCalendar(), 1);

describe("time helpers", () => {
  it("converts to IST hour-of-week", () => {
    // 2026-11-21 is a Saturday; 12:00 UTC = 17:30 IST
    const t = Date.parse("2026-11-21T12:00:00Z");
    expect(istParts(t).dow).toBe(5);
    expect(istParts(t).hour).toBe(17);
    expect(hourOfWeek(t)).toBe(5 * 24 + 17);
  });
  it("IST midnight round-trips", () => {
    expect(istParts(istMidnight("2026-09-01")).dateKey).toBe("2026-09-01");
    expect(istParts(istMidnight("2026-09-01")).hour).toBe(0);
  });
});

describe("synthetic data", () => {
  it("is deterministic and bounded", () => {
    const a = generateLot(spec, "2026-09-01", 3, demoCalendar(), 5);
    const b = generateLot(spec, "2026-09-01", 3, demoCalendar(), 5);
    expect(a).toEqual(b);
    expect(a.every((s) => s.occupied >= 0 && s.occupied <= 500)).toBe(true);
    expect(a.length).toBe(3 * 96);
  });
  it("PRNG is in [0,1)", () => {
    const r = rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("normCdf", () => {
  it("matches known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.2815515)).toBeCloseTo(0.9, 3);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("forecast", () => {
  const model = fitModel("m1", 500, data);
  // Saturday 18:30 IST, a busy mall time
  const sat = new Date(istMidnight("2026-10-17") + 18.5 * 3600_000);

  it("orders p10 <= p50 <= p90 within capacity", () => {
    const r = forecastWithModel(model, { lotId: "m1", targetTime: sat });
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
    expect(r.p10).toBeGreaterThanOrEqual(0);
    expect(r.p90).toBeLessThanOrEqual(500);
    expect(r.pFull).toBeGreaterThanOrEqual(0);
    expect(r.pFull).toBeLessThanOrEqual(1);
  });

  it("predicts fewer free slots on Saturday evening than Tuesday morning", () => {
    const tue = new Date(istMidnight("2026-10-13") + 7 * 3600_000);
    const a = forecastWithModel(model, { lotId: "m1", targetTime: sat });
    const b = forecastWithModel(model, { lotId: "m1", targetTime: tue });
    expect(a.p50).toBeLessThan(b.p50);
  });

  it("live count pulls a short-horizon forecast toward it", () => {
    const now = new Date(sat.getTime() - 15 * 60_000);
    const noLive = forecastWithModel(model, { lotId: "m1", targetTime: sat });
    const fullNow = forecastWithModel(model, { lotId: "m1", targetTime: sat, live: { occupied: 495, asOf: now } });
    expect(fullNow.p50).toBeLessThan(noLive.p50);
  });

  it("live influence fades with horizon", () => {
    const asOf = new Date(sat.getTime() - 6 * 3600_000);
    const near = forecastWithModel(model, { lotId: "m1", targetTime: new Date(asOf.getTime() + 15 * 60_000), live: { occupied: 495, asOf } });
    const far = forecastWithModel(model, { lotId: "m1", targetTime: new Date(asOf.getTime() + 6 * 3600_000), live: { occupied: 495, asOf } });
    const farNoLive = forecastWithModel(model, { lotId: "m1", targetTime: new Date(asOf.getTime() + 6 * 3600_000) });
    expect(Math.abs(far.p50 - farNoLive.p50)).toBeLessThan(15);
    expect(near.p50).toBeLessThan(60);
  });

  it("stale feed widens the interval and is flagged", () => {
    const now = new Date(sat.getTime() - 30 * 60_000);
    const fresh = forecastWithModel(model, { lotId: "m1", targetTime: sat, live: { occupied: 250, asOf: now }, feedAgeMin: 1 });
    const stale = forecastWithModel(model, { lotId: "m1", targetTime: sat, live: { occupied: 250, asOf: now }, feedAgeMin: 45 });
    expect(stale.stale).toBe(true);
    expect(fresh.stale).toBe(false);
    expect(stale.p90 - stale.p10).toBeGreaterThan(fresh.p90 - fresh.p10);
  });

  it("applies rain and event flags learned from history", () => {
    const mallEvent = forecastWithModel(model, { lotId: "m1", targetTime: sat, flags: { event: 1 } });
    const plain = forecastWithModel(model, { lotId: "m1", targetTime: sat });
    expect(mallEvent.p50).toBeLessThanOrEqual(plain.p50);
  });

  it("higher approach congestion lowers predicted free slots", () => {
    const a = forecastWithModel(model, { lotId: "m1", targetTime: sat, congestionIndex: 0.95 });
    const b = forecastWithModel(model, { lotId: "m1", targetTime: sat, congestionIndex: 0.1 });
    expect(a.p50).toBeLessThanOrEqual(b.p50);
  });

  it("cold start flags itself and widens the band", () => {
    const peer = fitModel("p", 400, generateLot({ ...spec, id: "p", capacity: 400 }, "2026-09-01", 42, demoCalendar(), 9));
    const cold = fitModel("c", 500, data.slice(0, 3 * 96), [peer]);
    const r = forecastWithModel(cold, { lotId: "c", targetTime: sat });
    const w = forecastWithModel(model, { lotId: "m1", targetTime: sat });
    expect(r.coldStart).toBe(true);
    expect(w.coldStart).toBe(false);
    expect(r.p90 - r.p10).toBeGreaterThan(w.p90 - w.p10);
  });

  it("refuses to fit with no data and no peers", () => {
    expect(() => fitModel("x", 100, [])).toThrow();
  });

  it("service throws for unknown lots", async () => {
    const svc = new BaselineForecastService(new Map([["m1", model]]));
    await expect(svc.forecast({ lotId: "nope", targetTime: sat })).rejects.toThrow();
    const ok = await svc.forecast({ lotId: "m1", targetTime: sat });
    expect(ok.modelVersion).toBe("baseline-how-v1");
  });

  it("confidence labels", () => {
    expect(confidenceLabel(0, 0.9, 100)).toBe("Probably full");
    expect(confidenceLabel(3, 0.2, 100)).toBe("Tight");
    expect(confidenceLabel(40, 0, 100)).toBe("Likely space");
  });
});

describe("backtest gate", () => {
  it("meets committed thresholds", () => {
    const fails = checkThresholds(runBacktest(), thresholds);
    expect(fails).toEqual([]);
  }, 60_000);
});
