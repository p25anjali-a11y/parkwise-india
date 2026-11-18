import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@parkwise/pricing";
import { eventUpliftFor, signalsFor, withEventUplift } from "./quote-inputs";

const arrival = new Date("2026-11-20T18:00:00Z");

describe("quote inputs", () => {
  it("applies event uplift only when the stay overlaps an event window", () => {
    const ev = [{ starts_at: "2026-11-20T19:00:00Z", ends_at: "2026-11-20T23:00:00Z", impact: 0.9 }];
    expect(eventUpliftFor(ev, arrival, 60)).toBe(0.23);
    expect(eventUpliftFor(ev, new Date("2026-11-22T18:00:00Z"), 60)).toBe(0);
  });
  it("takes the largest impact and clamps it", () => {
    const ev = [
      { starts_at: "2026-11-20T17:00:00Z", ends_at: "2026-11-20T20:00:00Z", impact: 5 },
      { starts_at: "2026-11-20T17:00:00Z", ends_at: "2026-11-20T20:00:00Z", impact: 0.2 },
    ];
    expect(eventUpliftFor(ev, arrival, 60)).toBe(0.25);
  });
  const now = new Date("2026-11-20T17:30:00Z");
  const fetched = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();

  it("uses rain only when fresh, real and near arrival", () => {
    const row = { kind: "rain_prob", value: 0.9, valid_at: "2026-11-20T19:00:00Z", created_at: fetched(30), source: "Open-Meteo" };
    expect(signalsFor([row], arrival, now).signals.rain).toBe(true);
    expect(signalsFor([row], arrival, now).inputs.find((i) => i.name === "weather")?.status).toBe("used");
    expect(signalsFor([{ ...row, valid_at: "2026-11-21T19:00:00Z" }], arrival, now).signals.rain).toBe(false);
    expect(signalsFor([{ ...row, value: 0.3 }], arrival, now).signals.rain).toBe(false);
  });
  it("ignores stale weather and says so", () => {
    const r = signalsFor([{ kind: "rain_prob", value: 0.9, valid_at: "2026-11-20T19:00:00Z", created_at: fetched(400) }], arrival, now);
    expect(r.signals.rain).toBe(false);
    expect(r.inputs.find((i) => i.name === "weather")?.status).toBe("stale");
  });
  it("never uses mock signals", () => {
    const r = signalsFor([{ kind: "rain_prob", value: 0.9, valid_at: "2026-11-20T19:00:00Z", created_at: fetched(5), is_mock: true }], arrival, now);
    expect(r.signals.rain).toBe(false);
    expect(r.inputs.find((i) => i.name === "weather")?.status).toBe("missing");
  });
  it("reads congestion only when fresh and the arrival is soon", () => {
    const row = { kind: "congestion", value: 0.8, valid_at: "2026-11-20T18:10:00Z", created_at: fetched(10), source: "TomTom" };
    expect(signalsFor([row], arrival, now).signals.congestionIndex).toBe(0.8);
    expect(signalsFor([{ ...row, created_at: fetched(90) }], arrival, now).signals.congestionIndex).toBeUndefined();
    const farArrival = new Date("2026-11-21T18:00:00Z");
    expect(signalsFor([{ ...row, valid_at: "2026-11-21T18:10:00Z" }], farArrival, now).signals.congestionIndex).toBeUndefined();
  });
  it("leaves rules unchanged with no uplift", () => {
    expect(withEventUplift(DEFAULT_RULES, 0)).toBe(DEFAULT_RULES);
    expect(withEventUplift(DEFAULT_RULES, 0.2).eventUplift).toBe(0.2);
  });
});
