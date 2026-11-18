import { describe, expect, it } from "vitest";
import { planScenario, tonightWindow, type DemoLot } from "./demo-scenario";

const lots: DemoLot[] = [
  { id: "s1", city: "Mumbai", category: "stadium", capacity: 1000, isSynthetic: true },
  { id: "m1", city: "Mumbai", category: "mall", capacity: 500, isSynthetic: true },
  { id: "o1", city: "Ahmedabad", category: "office", capacity: 300, isSynthetic: true },
  { id: "real", city: "Mumbai", category: "mall", capacity: 400, isSynthetic: false },
];
const now = new Date("2026-11-20T06:00:00Z"); // 11:30 IST

describe("planScenario", () => {
  it("never touches a non-synthetic lot", () => {
    for (const sc of ["busy_saturday", "ipl_night"] as const) {
      expect(planScenario(lots, sc, now).live.map((l) => l.lot_id)).not.toContain("real");
    }
  });
  it("fills the stadium and adds a match event on IPL night", () => {
    const p = planScenario(lots, "ipl_night", now);
    expect(p.live.find((l) => l.lot_id === "s1")!.occupied).toBe(960);
    expect(p.events).toHaveLength(1);
    expect(p.events[0]!.source).toBe("demo-sim");
    expect(p.signals).toHaveLength(0);
  });
  it("fills malls and adds rain on a busy Saturday", () => {
    const p = planScenario(lots, "busy_saturday", now);
    expect(p.live.find((l) => l.lot_id === "m1")!.occupied).toBe(465);
    expect(p.live.find((l) => l.lot_id === "o1")!.occupied).toBe(36);
    expect(p.signals.map((s) => s.city).sort()).toEqual(["Ahmedabad", "Mumbai"]);
    expect(p.events).toHaveLength(0);
  });
  it("computes tonight's window in IST", () => {
    const w = tonightWindow(now);
    expect(w.start.toISOString()).toBe("2026-11-20T14:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-20T18:00:00.000Z");
  });
});
