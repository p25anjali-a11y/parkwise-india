import { describe, expect, it } from "vitest";
import { simulatedOccupancy as sim } from "./simulated-occupancy";
import { resolveOccupancy } from "./resolve-occupancy";

// IST = UTC+5:30. 2026-11-18 is a Wednesday; 2026-11-21 a Saturday.
const wedNoon = new Date("2026-11-18T06:30:00Z"); // 12:00 IST
const wedNight = new Date("2026-11-17T21:30:00Z"); // 03:00 IST
const satEve = new Date("2026-11-21T13:00:00Z"); // 18:30 IST

describe("simulatedOccupancy", () => {
  it("is deterministic and within 0..1", () => {
    const a = sim({ lotId: "x", category: "mall", at: satEve });
    expect(sim({ lotId: "x", category: "mall", at: satEve })).toBe(a);
    for (const c of ["mall", "office", "hospital", "stadium", "other"]) for (const d of [wedNoon, wedNight, satEve]) {
      const v = sim({ lotId: "y", category: c, at: d, rainProb: 1, eventImpact: 1 });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("offices fill on weekday middays, not at night", () => {
    expect(sim({ lotId: "o", category: "office", at: wedNoon })).toBeGreaterThan(sim({ lotId: "o", category: "office", at: wedNight }) + 0.5);
  });
  it("malls are busiest on weekend evenings", () => {
    expect(sim({ lotId: "m", category: "mall", at: satEve })).toBeGreaterThan(0.5);
  });
  it("real rain lowers mall occupancy and a real event raises stadium occupancy", () => {
    expect(sim({ lotId: "m", category: "mall", at: satEve, rainProb: 1 })).toBeLessThan(sim({ lotId: "m", category: "mall", at: satEve, rainProb: 0 }));
    expect(sim({ lotId: "s", category: "stadium", at: satEve, eventImpact: 1 })).toBeGreaterThan(sim({ lotId: "s", category: "stadium", at: satEve }) + 0.5);
  });
  it("changes smoothly between 15-minute steps", () => {
    const a = sim({ lotId: "m", category: "mall", at: new Date(satEve.getTime()) });
    const b = sim({ lotId: "m", category: "mall", at: new Date(satEve.getTime() + 60_000) });
    expect(Math.abs(a - b)).toBeLessThan(0.02);
  });
});

describe("resolveOccupancy", () => {
  const base = { forecast: null, live: null, arrival: satEve, now: satEve };
  it("marks simulated lots with an asterisk", () => {
    const r = resolveOccupancy({ ...base, lot: { id: "s", category: "mall", is_synthetic: true } });
    expect(r.simulated).toBe(true);
    expect(r.input.source).toMatch(/\*$/);
    expect(r.value).not.toBeNull();
  });
  it("never simulates for a real lot: no data means null", () => {
    const r = resolveOccupancy({ ...base, lot: { id: "r", category: "mall", is_synthetic: false } });
    expect(r.simulated).toBe(false);
    expect(r.value).toBeNull();
  });
});
