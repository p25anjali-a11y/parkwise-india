import type { BreakdownStep, LockedQuote, Paise, PricingRules, Quote, QuoteInput } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function validateRules(r: PricingRules): void {
  if (r.baseRatePerHour <= 0) throw new Error("baseRatePerHour must be positive");
  if (r.floorMultiplier > r.ceilingMultiplier) throw new Error("floorMultiplier exceeds ceilingMultiplier");
  if (r.tiers.length === 0) throw new Error("at least one tier required");
  const sorted = [...r.tiers].sort((a, b) => a.minOccupancy - b.minOccupancy);
  if (sorted[0]!.minOccupancy !== 0) throw new Error("lowest tier must start at occupancy 0");
}

export function tierMultiplier(tiers: PricingRules["tiers"], occupancy: number): number {
  const occ = clamp(occupancy, 0, 1);
  let m = tiers[0]!.multiplier;
  for (const t of [...tiers].sort((a, b) => a.minOccupancy - b.minOccupancy)) {
    if (occ >= t.minOccupancy) m = t.multiplier;
  }
  return m;
}

/**
 * Pure price quote. Order: tier -> signal uplifts -> event -> smoothing -> clamp
 * (multiplier bounds, absolute rate bounds) -> municipal cap. A manual override
 * replaces the computed multiplier but is still clamped and capped.
 */
export function quote(input: QuoteInput): Quote {
  const { rules, predictedOccupancy, durationMin } = input;
  validateRules(rules);
  if (durationMin <= 0) throw new Error("durationMin must be positive");

  const steps: BreakdownStep[] = [{ kind: "base", label: "Base tariff", multiplier: 1 }];
  let m = 1;

  if (!rules.dynamicEnabled) {
    steps.push({ kind: "disabled", label: "Dynamic pricing off today", multiplier: 1 });
  } else if (rules.manualOverride) {
    m = rules.manualOverride.multiplier;
    steps.push({ kind: "override", label: `Operator override: ${rules.manualOverride.reason}`, multiplier: m });
  } else {
    if (predictedOccupancy === null) {
      steps.push({ kind: "no_data", label: "No fresh occupancy data for this lot: base tariff", multiplier: 1 });
    } else {
      m = tierMultiplier(rules.tiers, predictedOccupancy);
      steps.push({
        kind: "tier",
        label: `${Math.round(clamp(predictedOccupancy, 0, 1) * 100)}% full at arrival`,
        multiplier: m,
      });
    }

    let uplift = 0;
    const s = input.signals ?? {};
    if (s.rain) {
      uplift += rules.signalUplifts.rain;
      steps.push({ kind: "signal", label: "Rain expected", multiplier: round2(m + uplift) });
    }
    if ((s.congestionIndex ?? 0) >= rules.signalUplifts.congestionThreshold) {
      uplift += rules.signalUplifts.highCongestion;
      steps.push({ kind: "signal", label: "Heavy traffic near the lot", multiplier: round2(m + uplift) });
    }
    uplift = Math.min(uplift, rules.maxSignalUplift);
    m = round2(m + uplift);

    if (rules.eventUplift) {
      m = round2(m + rules.eventUplift);
      steps.push({ kind: "event", label: "Event nearby", multiplier: m });
    }

    if (input.previousMultiplier !== undefined) {
      const lo = input.previousMultiplier - rules.maxDecreasePerInterval;
      const hi = input.previousMultiplier + rules.maxIncreasePerInterval;
      const smoothed = round2(clamp(m, lo, hi));
      if (smoothed !== m) {
        m = smoothed;
        steps.push({ kind: "smoothing", label: "Limited change since last interval", multiplier: m });
      }
    }
  }

  const bounded = round2(clamp(m, rules.floorMultiplier, rules.ceilingMultiplier));
  if (bounded !== m) {
    m = bounded;
    steps.push({ kind: "clamp", label: "Within operator floor and ceiling", multiplier: m });
  }

  let rate: Paise = Math.round(rules.baseRatePerHour * m);
  const lo = rules.minRatePerHour ?? 0;
  const hi = rules.maxRatePerHour ?? Number.POSITIVE_INFINITY;
  const boundedRate = clamp(rate, lo, hi);
  if (boundedRate !== rate) {
    rate = boundedRate;
    m = round2(rate / rules.baseRatePerHour);
    steps.push({ kind: "clamp", label: "Within absolute rate bounds", multiplier: m });
  }
  if (rules.municipalCapPerHour !== undefined && rate > rules.municipalCapPerHour) {
    rate = rules.municipalCapPerHour;
    m = round2(rate / rules.baseRatePerHour);
    steps.push({ kind: "cap", label: "Municipal tariff cap applied", multiplier: m });
  }

  return {
    lotId: input.lotId,
    zoneId: input.zoneId,
    arrivalTime: input.arrivalTime.toISOString(),
    durationMin,
    predictedOccupancy: predictedOccupancy === null ? null : clamp(predictedOccupancy, 0, 1),
    multiplier: m,
    ratePerHour: rate,
    baseRatePerHour: rules.baseRatePerHour,
    total: Math.round((rate * durationMin) / 60),
    breakdown: steps,
    label: m < 1 ? "off-peak" : m === 1 ? "standard" : "peak",
    overstayRatePerHour: Math.round(rate * rules.overstayMultiplier),
    inputs: input.inputs ?? [],
  };
}

/** Lock a quote at booking. The hold window is the validity of the lock. */
export function lockQuote(q: Quote, now: Date, holdMinutes = 15): LockedQuote {
  return {
    ...q,
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + holdMinutes * 60_000).toISOString(),
  };
}

/**
 * Final charge for a stay. The locked hourly rate is never raised: a later,
 * higher quote is ignored. Minutes beyond the quoted duration are billed at the
 * overstay rate that was shown at booking. Staying less than quoted is not refunded
 * here (refund policy is an operator setting handled outside this pure function).
 */
export function settleStay(locked: LockedQuote, actualMinutes: number): Paise {
  const extra = Math.max(0, actualMinutes - locked.durationMin);
  return locked.total + Math.round((locked.overstayRatePerHour * extra) / 60);
}

export function isLockValid(locked: LockedQuote, now: Date): boolean {
  return now.getTime() <= new Date(locked.expiresAt).getTime();
}

export const DEFAULT_RULES: PricingRules = {
  baseRatePerHour: 6000,
  tiers: [
    { minOccupancy: 0, multiplier: 0.9 },
    { minOccupancy: 0.4, multiplier: 1 },
    { minOccupancy: 0.6, multiplier: 1.15 },
    { minOccupancy: 0.8, multiplier: 1.3 },
    { minOccupancy: 0.9, multiplier: 1.5 },
  ],
  floorMultiplier: 0.8,
  ceilingMultiplier: 2,
  maxIncreasePerInterval: 0.15,
  maxDecreasePerInterval: 0.2,
  signalUplifts: { rain: 0.05, highCongestion: 0.05, congestionThreshold: 0.7 },
  maxSignalUplift: 0.1,
  dynamicEnabled: true,
  overstayMultiplier: 1.5,
};
