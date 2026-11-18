import { OpenMeteoWeatherProvider, selectTrafficProvider } from "@parkwise/providers";
import { CITY_CENTRES, type LatLng } from "./geo";
import type { SignalRow } from "./quote-inputs";

/** fetch with a short server-side cache so a burst of requests makes one upstream call. */
const cached = (seconds: number): typeof fetch => (url, init) => fetch(url, { ...init, next: { revalidate: seconds } } as RequestInit);

/**
 * LIVE weather from Open-Meteo (no key), cached up to 10 minutes. Returns nothing if the call fails:
 * a failure shows up as "weather missing" on the quote, never as invented numbers.
 */
export async function liveWeatherRows(city: string, now: Date = new Date()): Promise<SignalRow[]> {
  const centre = CITY_CENTRES[city];
  if (!centre) return [];
  try {
    const pts = await new OpenMeteoWeatherProvider(cached(600)).rainForecast(centre, 48);
    return pts.map((p) => ({ kind: "rain_prob", value: p.probability, valid_at: p.validAt.toISOString(), created_at: now.toISOString(), is_mock: false, source: "open-meteo (live)" }));
  } catch {
    return [];
  }
}

/** LIVE traffic from TomTom, only when TOMTOM_API_KEY is set; cached up to 5 minutes. Otherwise nothing. */
export async function liveTrafficRows(at: LatLng, now: Date = new Date()): Promise<SignalRow[]> {
  const provider = selectTrafficProvider(process.env, cached(300));
  if (!provider) return [];
  try {
    const r = await provider.congestionAt(at);
    return [{ kind: "congestion", value: r.congestionIndex, valid_at: now.toISOString(), created_at: now.toISOString(), is_mock: false, source: "tomtom (live)" }];
  } catch {
    return [];
  }
}

/** Rain probability from the hourly row nearest `at` (within 90 minutes), else 0. */
export function rainProbAt(rows: SignalRow[], at: Date): number {
  let best = 0;
  let gap = Infinity;
  for (const r of rows) {
    if (r.kind !== "rain_prob" || r.is_mock) continue;
    const g = Math.abs(new Date(r.valid_at).getTime() - at.getTime());
    if (g < gap && g <= 90 * 60_000) { gap = g; best = r.value; }
  }
  return best;
}
