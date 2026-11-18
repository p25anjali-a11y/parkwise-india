import { describe, expect, it } from "vitest";
import { HttpForecastService } from "./http";

const ok = { lotId: "l", targetTime: "2026-11-20T11:00:00Z", capacity: 100, p10: 10, p50: 20, p90: 30, pFull: 0, confidence: "Likely space", modelVersion: "x", coldStart: false, stale: false };

describe("HttpForecastService", () => {
  it("posts the contract and returns the parsed result", async () => {
    let sent: Record<string, unknown> = {};
    let url = "";
    const f = (async (u: string, init: RequestInit) => {
      url = u;
      sent = JSON.parse(init.body as string);
      return new Response(JSON.stringify(ok));
    }) as unknown as typeof fetch;
    const r = await new HttpForecastService("http://svc/", new Map([["l", 100]]), f).forecast({ lotId: "l", targetTime: new Date("2026-11-20T11:00:00Z"), live: { occupied: 20, asOf: new Date() } });
    expect(url).toBe("http://svc/forecast");
    expect(sent).toMatchObject({ lotId: "l", capacity: 100, live: { occupied: 20 } });
    expect(r.p50).toBe(20);
  });
  it("rejects unknown lots, HTTP errors and nonsense quantiles", async () => {
    const good = (async () => new Response(JSON.stringify(ok))) as unknown as typeof fetch;
    await expect(new HttpForecastService("http://s", new Map(), good).forecast({ lotId: "l", targetTime: new Date() })).rejects.toThrow("no capacity");
    const bad = (async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    await expect(new HttpForecastService("http://s", new Map([["l", 1]]), bad).forecast({ lotId: "l", targetTime: new Date() })).rejects.toThrow("500");
    const weird = (async () => new Response(JSON.stringify({ ...ok, p10: 50 }))) as unknown as typeof fetch;
    await expect(new HttpForecastService("http://s", new Map([["l", 1]]), weird).forecast({ lotId: "l", targetTime: new Date() })).rejects.toThrow("invalid");
  });
});
