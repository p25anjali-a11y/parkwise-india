import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@parkwise/pricing";
import { simulatedDailyGross } from "./simulated-revenue";

const now = new Date("2026-11-22T12:00:00Z");
const base = { lotId: "lot-1", category: "mall", capacity: 800, rules: { ...DEFAULT_RULES, baseRatePerHour: 5000 }, days: 7, now };

describe("simulatedDailyGross", () => {
  it("returns one entry per day, oldest first, ending today (IST)", () => {
    const d = simulatedDailyGross(base);
    expect(d).toHaveLength(7);
    expect(d[6]!.day).toBe("2026-11-22");
    expect(d[0]!.day).toBe("2026-11-16");
  });
  it("is deterministic and integer paise", () => {
    const a = simulatedDailyGross(base);
    expect(simulatedDailyGross(base)).toEqual(a);
    for (const x of a) expect(Number.isInteger(x.paise)).toBe(true);
  });
  it("counts only hours that have already happened today", () => {
    const early = simulatedDailyGross({ ...base, now: new Date("2026-11-21T19:00:00Z") }); // 00:30 IST on the 22nd
    const late = simulatedDailyGross(base);
    expect(early[6]!.paise).toBeLessThan(late[6]!.paise);
  });
  it("earns more with more bays and a higher rate", () => {
    const small = simulatedDailyGross({ ...base, capacity: 100 })[3]!.paise;
    const big = simulatedDailyGross({ ...base, capacity: 800 })[3]!.paise;
    expect(big).toBeGreaterThan(small * 5);
  });
});
