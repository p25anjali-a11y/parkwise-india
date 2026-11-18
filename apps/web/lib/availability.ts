import { confidenceLabel } from "@parkwise/forecast";

export interface ForecastRow {
  target_time: string;
  p10: number;
  p50: number;
  p90: number;
  p_full: number;
  model_version: string;
  stale: boolean;
  cold_start: boolean;
}

/** The forecast row closest to `target`, only if it lies within `toleranceMin`. */
export function nearestForecast(rows: ForecastRow[], target: Date, toleranceMin = 8): ForecastRow | null {
  let best: ForecastRow | null = null;
  let bestGap = Infinity;
  for (const r of rows) {
    const gap = Math.abs(Date.parse(r.target_time) - target.getTime());
    if (gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best && bestGap <= toleranceMin * 60_000 ? best : null;
}

export function describeForecast(r: ForecastRow, capacity: number) {
  return {
    label: confidenceLabel(r.p10, r.p_full, capacity),
    freeBays: { likely: Math.max(0, capacity - r.p50), pessimistic: Math.max(0, capacity - r.p90), optimistic: Math.max(0, capacity - r.p10) },
    pFull: r.p_full,
    stale: r.stale,
    coldStart: r.cold_start,
    modelVersion: r.model_version,
  };
}
