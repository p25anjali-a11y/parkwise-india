import { describe, expect, it } from "vitest";
import type { TrafficSignalProvider, WeatherProvider } from "@parkwise/providers";
import { runIngestion, type SignalRow, type SignalStore } from "./index";

function memoryStore() {
  const city: SignalRow[] = [];
  const lot = new Map<string, SignalRow>();
  const health: string[] = [];
  const store: SignalStore = {
    async replaceCityForecast(_s, c, from, rows) {
      for (let i = city.length - 1; i >= 0; i--) if (city[i]!.city === c && Date.parse(city[i]!.valid_at) >= from.getTime()) city.splice(i, 1);
      city.push(...rows);
    },
    async replaceLotReading(_s, id, row) {
      lot.set(id, row);
    },
    async recordHealth(src, ok) {
      health.push(`${src}:${ok}`);
    },
  };
  return { store, city, lot, health };
}

const now = new Date("2026-11-20T10:00:00Z");
const weather: WeatherProvider = {
  name: "wx", isMock: false,
  async rainForecast() {
    return [{ validAt: new Date("2026-11-20T08:00:00Z"), probability: 0.1 }, { validAt: new Date("2026-11-20T11:00:00Z"), probability: 0.8 }];
  },
};
const lots = [{ id: "L1", city: "Mumbai", lat: 19, lng: 72.8 }, { id: "L2", city: "Mumbai", lat: 19.1, lng: 72.9 }];

describe("runIngestion", () => {
  it("writes rain per city, drops stale points, and is idempotent", async () => {
    const m = memoryStore();
    await runIngestion({ weather, traffic: null, store: m.store, lots, now });
    await runIngestion({ weather, traffic: null, store: m.store, lots, now });
    expect(m.city).toHaveLength(1);
    expect(m.city[0]!.value).toBe(0.8);
    expect(m.health).toEqual(["weather:true", "weather:true"]);
  });
  it("skips traffic without a provider and writes no congestion", async () => {
    const m = memoryStore();
    const r = await runIngestion({ weather, traffic: null, store: m.store, lots, now });
    expect(r.traffic.skipped).toBe(true);
    expect(m.lot.size).toBe(0);
  });
  it("records per-lot congestion and tolerates single-lot failures", async () => {
    const m = memoryStore();
    const traffic: TrafficSignalProvider = {
      name: "tt", isMock: false,
      async congestionAt(p) {
        if (p.lat === 19.1) throw new Error("boom");
        return { congestionIndex: 0.6, currentSpeedKmh: 16, freeFlowSpeedKmh: 40 };
      },
    };
    const r = await runIngestion({ weather, traffic, store: m.store, lots, now });
    expect(m.lot.get("L1")!.value).toBe(0.6);
    expect(m.lot.has("L2")).toBe(false);
    expect(r.traffic.errors[0]).toContain("boom");
    expect(m.health).toContain("traffic:false");
  });
  it("a failing weather source is reported and does not throw", async () => {
    const m = memoryStore();
    const bad: WeatherProvider = { name: "wx", isMock: false, async rainForecast() { throw new Error("down"); } };
    const r = await runIngestion({ weather: bad, traffic: null, store: m.store, lots, now });
    expect(r.weather.errors[0]).toContain("down");
    expect(m.health).toEqual(["weather:false"]);
  });
});
