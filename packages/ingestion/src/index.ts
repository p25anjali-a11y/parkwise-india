import type { LatLng, TrafficSignalProvider, WeatherProvider } from "@parkwise/providers";

export interface SignalRow {
  lot_id: string | null;
  city: string;
  kind: "rain_prob" | "congestion";
  value: number;
  valid_at: string;
  source: string;
  is_mock: boolean;
  raw_payload?: unknown;
}

export interface IngestLot {
  id: string;
  city: string;
  lat: number;
  lng: number;
}

/** Persistence port. The web app implements it with the service-role client; tests use an in-memory one. */
export interface SignalStore {
  /** Replace a source's rows for a city from `from` onward (idempotent re-runs). */
  replaceCityForecast(source: string, city: string, from: Date, rows: SignalRow[]): Promise<void>;
  /** Replace a source's congestion row for one lot. */
  replaceLotReading(source: string, lotId: string, row: SignalRow): Promise<void>;
  recordHealth(source: "weather" | "traffic", ok: boolean, isMock: boolean, error?: string): Promise<void>;
}

export interface IngestReport {
  weather: { cities: number; rows: number; errors: string[] };
  traffic: { lots: number; errors: string[]; skipped: boolean };
}

export const CITY_CENTRES: Record<string, LatLng> = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

/** Pulls weather per city and traffic per lot. One failing source never blocks the others. */
export async function runIngestion(deps: { weather: WeatherProvider; traffic: TrafficSignalProvider | null; store: SignalStore; lots: IngestLot[]; now?: Date; forecastHours?: number }): Promise<IngestReport> {
  const now = deps.now ?? new Date();
  const hours = deps.forecastHours ?? 48;
  const report: IngestReport = { weather: { cities: 0, rows: 0, errors: [] }, traffic: { lots: 0, errors: [], skipped: !deps.traffic } };

  const cities = [...new Set(deps.lots.map((l) => l.city))];
  let weatherOk = true;
  for (const city of cities) {
    const centre = CITY_CENTRES[city];
    if (!centre) continue;
    try {
      const pts = await deps.weather.rainForecast(centre, hours);
      const from = new Date(now.getTime() - 3600_000);
      const rows: SignalRow[] = pts.filter((p) => p.validAt >= from).map((p) => ({ lot_id: null, city, kind: "rain_prob", value: p.probability, valid_at: p.validAt.toISOString(), source: deps.weather.name, is_mock: deps.weather.isMock }));
      await deps.store.replaceCityForecast(deps.weather.name, city, from, rows);
      report.weather.cities++;
      report.weather.rows += rows.length;
    } catch (e) {
      weatherOk = false;
      report.weather.errors.push(`${city}: ${(e as Error).message}`);
    }
  }
  if (cities.length) await deps.store.recordHealth("weather", weatherOk, deps.weather.isMock, report.weather.errors[0]);

  if (deps.traffic) {
    let trafficOk = true;
    for (const lot of deps.lots) {
      try {
        const r = await deps.traffic.congestionAt({ lat: lot.lat, lng: lot.lng });
        await deps.store.replaceLotReading(deps.traffic.name, lot.id, { lot_id: lot.id, city: lot.city, kind: "congestion", value: r.congestionIndex, valid_at: now.toISOString(), source: deps.traffic.name, is_mock: deps.traffic.isMock, raw_payload: r });
        report.traffic.lots++;
      } catch (e) {
        trafficOk = false;
        report.traffic.errors.push(`${lot.id}: ${(e as Error).message}`);
      }
    }
    await deps.store.recordHealth("traffic", trafficOk, deps.traffic.isMock, report.traffic.errors[0]);
  }
  return report;
}
