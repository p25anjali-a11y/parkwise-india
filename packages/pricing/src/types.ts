/** All money is integer paise (1 INR = 100 paise) to avoid float drift. */
export type Paise = number;

export interface OccupancyTier {
  /** Tier applies when predicted occupancy (0..1) is >= this value. */
  minOccupancy: number;
  multiplier: number;
}

export interface PricingRules {
  /** Flat base tariff, paise per hour. */
  baseRatePerHour: Paise;
  tiers: OccupancyTier[];
  /** Multiplier bounds. */
  floorMultiplier: number;
  ceilingMultiplier: number;
  /** Absolute hourly price bounds (paise), applied after the multiplier. */
  minRatePerHour?: Paise;
  maxRatePerHour?: Paise;
  /** Municipal or regulatory cap on the hourly rate, applied last. */
  municipalCapPerHour?: Paise;
  /** Max multiplier change per pricing interval, versus the previous multiplier. */
  maxIncreasePerInterval: number;
  maxDecreasePerInterval: number;
  /** Additive uplifts from demand signals. Each is capped by maxSignalUplift in total. */
  signalUplifts: {
    rain: number;
    highCongestion: number;
    /** Congestion index (0..1) at or above which highCongestion applies. */
    congestionThreshold: number;
  };
  maxSignalUplift: number;
  /** Event multiplier added on top (e.g. IPL match = +0.25). Operator-set. */
  eventUplift?: number;
  /** Dynamic pricing switched off for the day: price stays at base. */
  dynamicEnabled: boolean;
  /** Manual override with reason; replaces computed multiplier but still clamped. */
  manualOverride?: { multiplier: number; reason: string };
  /** Overstay rate multiplier on the locked hourly rate (transparent, shown at booking). */
  overstayMultiplier: number;
}

export interface DemandSignals {
  rain?: boolean;
  congestionIndex?: number;
}

export interface QuoteInput {
  lotId: string;
  zoneId: string;
  rules: PricingRules;
  /** Predicted occupancy at arrival (0..1), from the forecast service. */
  predictedOccupancy: number;
  arrivalTime: Date;
  durationMin: number;
  signals?: DemandSignals;
  /** Multiplier in force at the previous pricing interval, for smoothing. */
  previousMultiplier?: number;
}

export type StepKind = "base" | "tier" | "signal" | "event" | "smoothing" | "clamp" | "override" | "cap" | "disabled";

export interface BreakdownStep {
  kind: StepKind;
  label: string;
  /** Multiplier after this step. */
  multiplier: number;
}

export interface Quote {
  lotId: string;
  zoneId: string;
  arrivalTime: string;
  durationMin: number;
  predictedOccupancy: number;
  multiplier: number;
  ratePerHour: Paise;
  baseRatePerHour: Paise;
  total: Paise;
  /** Why this price: ordered steps from base to final. */
  breakdown: BreakdownStep[];
  /** Driver-facing label. */
  label: "off-peak" | "standard" | "peak";
  overstayRatePerHour: Paise;
}

export interface LockedQuote extends Quote {
  lockedAt: string;
  expiresAt: string;
}
