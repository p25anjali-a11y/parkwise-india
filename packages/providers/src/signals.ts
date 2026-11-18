import type { LatLng } from "./routing";

type Fetch = typeof fetch;

export interface RainPoint {
  validAt: Date;
  /** Probability 0..1 of measurable rain in that hour. */
  probability: number;
}

export interface WeatherProvider {
  readonly name: string;
  readonly isMock: boolean;
  rainForecast(at: LatLng, hours: number): Promise<RainPoint[]>;
}

/**
 * Open-Meteo hourly precipitation probability. No API key. Free for non-commercial use only: a commercial
 * launch needs their paid plan or another provider (IMD data licensing is a separate question).
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly name = "open-meteo";
  readonly isMock = false;
  constructor(private readonly doFetch: Fetch = fetch) {}
  async rainForecast(at: LatLng, hours: number): Promise<RainPoint[]> {
    const days = Math.min(7, Math.max(1, Math.ceil(hours / 24) + 1));
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.lat}&longitude=${at.lng}&hourly=precipitation_probability&timezone=UTC&forecast_days=${days}`;
    const res = await this.doFetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const j = (await res.json()) as { hourly?: { time?: string[]; precipitation_probability?: (number | null)[] } };
    const t = j.hourly?.time;
    const p = j.hourly?.precipitation_probability;
    if (!t || !p || t.length !== p.length) throw new Error("Open-Meteo returned no hourly precipitation probability");
    const out: RainPoint[] = [];
    for (let i = 0; i < t.length; i++) {
      const v = p[i];
      if (v == null) continue;
      out.push({ validAt: new Date(`${t[i]}Z`), probability: Math.min(1, Math.max(0, v / 100)) });
    }
    return out.slice(0, hours);
  }
}

export interface TrafficReading {
  /** 0 = free flow, 1 = standstill. */
  congestionIndex: number;
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;
}

export interface TrafficSignalProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** Congestion on the road segment nearest the point. */
  congestionAt(at: LatLng): Promise<TrafficReading>;
}

/** TomTom Traffic Flow Segment Data (absolute style, zoom 10, JSON). Needs TOMTOM_API_KEY. Not yet run with a live key. */
export class TomTomTrafficProvider implements TrafficSignalProvider {
  readonly name = "tomtom";
  readonly isMock = false;
  constructor(private readonly apiKey: string, private readonly doFetch: Fetch = fetch) {}
  async congestionAt(at: LatLng): Promise<TrafficReading> {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${encodeURIComponent(this.apiKey)}&point=${at.lat},${at.lng}`;
    const res = await this.doFetch(url);
    if (!res.ok) throw new Error(`TomTom flow ${res.status}`);
    const j = (await res.json()) as { flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number } };
    const cur = j.flowSegmentData?.currentSpeed;
    const free = j.flowSegmentData?.freeFlowSpeed;
    if (typeof cur !== "number" || typeof free !== "number" || free <= 0) throw new Error("TomTom returned no flow data");
    return { congestionIndex: Math.round(Math.min(1, Math.max(0, 1 - cur / free)) * 100) / 100, currentSpeedKmh: cur, freeFlowSpeedKmh: free };
  }
}

/** With no traffic key there is no congestion signal at all: we write nothing rather than invent numbers. */
export function selectTrafficProvider(env: Record<string, string | undefined>, doFetch?: Fetch): TrafficSignalProvider | null {
  return env.TOMTOM_API_KEY ? new TomTomTrafficProvider(env.TOMTOM_API_KEY, doFetch) : null;
}

export function selectWeatherProvider(doFetch?: Fetch): WeatherProvider {
  return new OpenMeteoWeatherProvider(doFetch);
}
