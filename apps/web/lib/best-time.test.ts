import { describe, expect, it } from "vitest";
import { suggestBest } from "./best-time";

const p = (offsetMin: number, ratePerHour: number) => ({ offsetMin, at: new Date(offsetMin * 60000).toISOString(), ratePerHour });

describe("suggestBest", () => {
  it("suggests a cheaper later hour", () => {
    const r = suggestBest([p(0, 8000), p(60, 7000), p(120, 6000), p(180, 9000)]);
    expect(r).toMatchObject({ kind: "later", savingPaise: 2000, savingPct: 25 });
    if (r?.kind === "later") expect(r.best.offsetMin).toBe(120);
  });
  it("says now is cheapest when nothing is cheaper", () => {
    expect(suggestBest([p(0, 6000), p(60, 7000)])?.kind).toBe("already");
  });
  it("ignores tiny savings", () => {
    expect(suggestBest([p(0, 6000), p(60, 5900)])?.kind).toBe("already");
  });
  it("returns null for no points", () => expect(suggestBest([])).toBeNull());
});
