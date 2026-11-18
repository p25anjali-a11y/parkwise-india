import type { ForecastRequest, ForecastResult, ForecastService } from "./types";

type Fetch = typeof fetch;

/** Calls the Python forecast service. Capacity is not part of ForecastRequest, so it is supplied per lot. */
export class HttpForecastService implements ForecastService {
  constructor(private readonly baseUrl: string, private readonly capacityByLot: Map<string, number>, private readonly doFetch: Fetch = fetch) {}

  async forecast(req: ForecastRequest): Promise<ForecastResult> {
    const capacity = this.capacityByLot.get(req.lotId);
    if (!capacity) throw new Error(`no capacity known for lot ${req.lotId}`);
    const res = await this.doFetch(`${this.baseUrl.replace(/\/$/, "")}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: req.lotId,
        capacity,
        targetTime: req.targetTime.toISOString(),
        now: (req.now ?? new Date()).toISOString(),
        live: req.live ? { occupied: req.live.occupied } : undefined,
        feedAgeMin: req.feedAgeMin,
      }),
    });
    if (!res.ok) throw new Error(`forecast service ${res.status}`);
    const j = (await res.json()) as ForecastResult;
    if (typeof j.p50 !== "number" || j.p10 > j.p50 || j.p50 > j.p90) throw new Error("forecast service returned an invalid result");
    return j;
  }
}
