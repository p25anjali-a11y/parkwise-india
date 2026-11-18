import { isFresh, type DataInput } from "@parkwise/pricing";
import type { ForecastRow } from "./availability";

export interface LiveRow {
  occupied: number;
  capacity: number;
  updated_at: string;
  source: string;
  is_synthetic?: boolean;
}

export interface OccupancyChoice {
  /** 0..1, or null when there is no fresh real data. */
  value: number | null;
  input: DataInput;
  modelVersion: string | null;
}

/** Arrivals further out than this cannot be priced from a live count. */
const LIVE_HORIZON_MIN = 60;

/**
 * Picks the occupancy the price may use. Order: a fresh forecast for the arrival time (built only from real
 * snapshots), then a fresh live count when arrival is soon. Otherwise null: the quote stays at the base tariff.
 * Nothing is estimated and synthetic rows are never used.
 */
export function chooseOccupancy(args: {
  forecast: (ForecastRow & { generated_at?: string | null }) | null;
  live: LiveRow | null;
  arrival: Date;
  now?: Date;
}): OccupancyChoice {
  const now = args.now ?? new Date();
  const { forecast, live, arrival } = args;
  const liveOk = !!live && live.capacity > 0 && !live.is_synthetic && live.source !== "synthetic";

  if (forecast && liveOk && !forecast.stale && !forecast.cold_start && isFresh("forecast", forecast.generated_at, now)) {
    return {
      value: Math.min(1, Math.max(0, forecast.p50 / live!.capacity)),
      input: { name: "occupancy", status: "used", source: `forecast ${forecast.model_version}`, asOf: forecast.generated_at ?? undefined },
      modelVersion: forecast.model_version,
    };
  }
  if (liveOk && arrival.getTime() - now.getTime() <= LIVE_HORIZON_MIN * 60_000) {
    if (isFresh("occupancy", live!.updated_at, now)) {
      return {
        value: Math.min(1, live!.occupied / live!.capacity),
        input: { name: "occupancy", status: "used", source: `live count (${live!.source})`, asOf: live!.updated_at },
        modelVersion: "live-count",
      };
    }
    return { value: null, input: { name: "occupancy", status: "stale", source: `live count (${live!.source})`, asOf: live!.updated_at }, modelVersion: null };
  }
  return { value: null, input: { name: "occupancy", status: live ? "stale" : "missing", asOf: live?.updated_at }, modelVersion: null };
}
