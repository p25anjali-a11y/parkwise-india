import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("a", 3, 60_000, t).ok).toBe(true);
    const r = rateLimit("a", 3, 60_000, t + 1000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(59);
  });
  it("resets after the window and isolates keys", () => {
    const t = 2_000_000;
    rateLimit("b", 1, 1000, t);
    expect(rateLimit("b", 1, 1000, t + 10).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, t + 1001).ok).toBe(true);
    expect(rateLimit("c", 1, 1000, t).ok).toBe(true);
  });
});
