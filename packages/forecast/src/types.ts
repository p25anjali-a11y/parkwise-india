export type LotCategory = "mall" | "office" | "stadium" | "hospital";

export interface DayFlags {
  holiday?: boolean;
  festival?: boolean;
  /** Event intensity 0..1 (1 = full effect learned from history). */
  event?: number;
  rain?: boolean;
}

/** One occupancy observation. t = epoch ms. */
export interface Sample {
  t: number;
  occupied: number;
  flags: DayFlags;
}

export interface ForecastRequest {
  lotId: string;
  /** Arrival time = now + routing ETA. */
  targetTime: Date;
  now?: Date;
  /** Latest live count, if the feed is healthy. */
  live?: { occupied: number; asOf: Date; momentumPerHour?: number };
  /** Calendar and weather flags for the target time. */
  flags?: DayFlags;
  /** Flags in force at `live.asOf` (defaults to `flags`). */
  nowFlags?: DayFlags;
  /** Lot-approach congestion index 0..1 (hand-set prior coefficient, not learned). */
  congestionIndex?: number;
  /** Minutes since the last feed update; widens the interval when stale. */
  feedAgeMin?: number;
}

export type ConfidenceLabel = "Likely space" | "Tight" | "Probably full";

export interface ForecastResult {
  lotId: string;
  targetTime: string;
  capacity: number;
  p10: number;
  p50: number;
  p90: number;
  pFull: number;
  confidence: ConfidenceLabel;
  modelVersion: string;
  coldStart: boolean;
  stale: boolean;
}

/** Implementations: TS baseline now, Python gradient boosting service later. */
export interface ForecastService {
  forecast(req: ForecastRequest): Promise<ForecastResult>;
}
