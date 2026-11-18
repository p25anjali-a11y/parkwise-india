import { isFresh, type DataInput, type DemandSignals, type PricingRules } from "@parkwise/pricing";

/** Event uplift added to the multiplier at full impact (impact 1.0). Operator rules can override via eventUplift. */
export const EVENT_UPLIFT_AT_FULL_IMPACT = 0.25;

export interface EventRow {
  starts_at: string;
  ends_at: string;
  impact: number | null;
}

/** Events within two hours either side of the stay window count; the biggest impact wins. */
export function eventUpliftFor(events: EventRow[], arrival: Date, durationMin: number): number {
  const from = arrival.getTime() - 2 * 3600_000;
  const to = arrival.getTime() + durationMin * 60_000 + 2 * 3600_000;
  let best = 0;
  for (const e of events) {
    const s = new Date(e.starts_at).getTime();
    const en = new Date(e.ends_at).getTime();
    if (s <= to && en >= from) best = Math.max(best, Math.min(1, Math.max(0, e.impact ?? 0.5)));
  }
  return Math.round(best * EVENT_UPLIFT_AT_FULL_IMPACT * 100) / 100;
}

export interface SignalRow {
  kind: string;
  value: number;
  /** When the prediction or reading applies. */
  valid_at: string;
  /** When we fetched it. Freshness is judged on this. */
  created_at?: string | null;
  /** Mock rows never count as real data. */
  is_mock?: boolean;
  source?: string;
}

/** Traffic is a live reading, so it only informs quotes for arrivals within this many minutes of now. */
const TRAFFIC_HORIZON_MIN = 60;

/**
 * Real signals only. Mock rows are ignored. Rain counts when a probability of 0.6 or more, fetched within
 * the weather freshness limit, is valid within three hours of arrival. Congestion counts only when read within
 * the traffic freshness limit and the arrival is soon. Anything else is reported as missing or stale, not guessed.
 */
export function signalsFor(rows: SignalRow[], arrival: Date, now: Date = new Date()): { signals: DemandSignals; inputs: DataInput[] } {
  const real = rows.filter((r) => r.is_mock !== true);
  const near = real.filter((r) => Math.abs(new Date(r.valid_at).getTime() - arrival.getTime()) <= 3 * 3600_000);

  const weather = near.filter((r) => r.kind === "rain_prob");
  const freshWeather = weather.filter((r) => isFresh("weather", r.created_at, now));
  const traffic = real.filter((r) => r.kind === "congestion" && Math.abs(new Date(r.valid_at).getTime() - arrival.getTime()) <= 3 * 3600_000);
  const arrivalSoon = arrival.getTime() - now.getTime() <= TRAFFIC_HORIZON_MIN * 60_000;
  const freshTraffic = arrivalSoon ? traffic.filter((r) => isFresh("traffic", r.created_at, now)) : [];

  const newest = (rs: SignalRow[]) => rs.map((r) => r.created_at ?? "").sort().at(-1) || undefined;
  const status = (name: DataInput["name"], all: SignalRow[], fresh: SignalRow[]): DataInput =>
    fresh.length
      ? { name, status: "used", source: fresh[0]!.source, asOf: newest(fresh) }
      : { name, status: all.length ? "stale" : "missing", source: all[0]?.source, asOf: newest(all) };

  return {
    signals: {
      rain: freshWeather.some((r) => r.value >= 0.6),
      congestionIndex: freshTraffic.length ? Math.max(...freshTraffic.map((r) => r.value)) : undefined,
    },
    inputs: [status("weather", weather, freshWeather), status("traffic", traffic, freshTraffic)],
  };
}

export function withEventUplift(rules: PricingRules, uplift: number): PricingRules {
  return uplift > 0 ? { ...rules, eventUplift: Math.max(rules.eventUplift ?? 0, uplift) } : rules;
}
