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
  it("detects rain near arrival only", () => {
    expect(signalsFor([{ kind: "rain_prob", value: 0.9, valid_at: "2026-11-20T19:00:00Z" }], arrival).rain).toBe(true);
    expect(signalsFor([{ kind: "rain_prob", value: 0.9, valid_at: "2026-11-21T19:00:00Z" }], arrival).rain).toBe(false);
    expect(signalsFor([{ kind: "rain_prob", value: 0.3, valid_at: "2026-11-20T19:00:00Z" }], arrival).rain).toBe(false);
  });
  it("reads congestion", () => {
    expect(signalsFor([{ kind: "congestion", value: 0.8, valid_at: "2026-11-20T18:10:00Z" }], arrival).congestionIndex).toBe(0.8);
  });
  it("leaves rules unchanged with no uplift", () => {
    expect(withEventUplift(DEFAULT_RULES, 0)).toBe(DEFAULT_RULES);
    expect(withEventUplift(DEFAULT_RULES, 0.2).eventUplift).toBe(0.2);
  });
});
