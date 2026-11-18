import { describe, expect, it } from "vitest";
import { FallbackRoutingProvider, GoogleRoutingProvider, MockRoutingProvider, selectRoutingProvider } from "./routing";

const A = { lat: 19.0866, lng: 72.889 };
const B = { lat: 18.9389, lng: 72.8258 };

describe("routing providers", () => {
  it("mock is labelled and gives a plausible estimate", async () => {
    const r = await new MockRoutingProvider().eta(A, B);
    expect(r.isMock).toBe(true);
    expect(r.trafficAware).toBe(false);
    expect(r.minutes).toBeGreaterThan(15);
    expect(r.minutes).toBeLessThan(90);
  });

  it("google adapter parses duration and distance and sends the key and field mask", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ routes: [{ duration: "1805s", distanceMeters: 21400 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new GoogleRoutingProvider("k", fake).eta(A, B);
    expect(r).toMatchObject({ minutes: 31, km: 21.4, provider: "google", isMock: false, trafficAware: true });
    const h = seen!.init.headers as Record<string, string>;
    expect(h["X-Goog-Api-Key"]).toBe("k");
    expect(h["X-Goog-FieldMask"]).toContain("routes.duration");
  });

  it("google adapter rejects errors and empty results", async () => {
    const bad = (async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
    await expect(new GoogleRoutingProvider("k", bad).eta(A, B)).rejects.toThrow("403");
    const empty = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(new GoogleRoutingProvider("k", empty).eta(A, B)).rejects.toThrow("no route");
  });

  it("fallback degrades to the labelled mock", async () => {
    const bad = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const r = await new FallbackRoutingProvider(new GoogleRoutingProvider("k", bad)).eta(A, B);
    expect(r.isMock).toBe(true);
  });

  it("selects the mock with no keys and flags unsupported keys", () => {
    expect(selectRoutingProvider({}).provider.name).toBe("mock");
    const s = selectRoutingProvider({ MAPPLS_REST_KEY: "x" });
    expect(s.provider.name).toBe("mock");
    expect(s.unsupported[0]).toContain("adapter not built");
    expect(selectRoutingProvider({ GOOGLE_MAPS_API_KEY: "g" }).provider.name).toBe("google+fallback");
  });
});
