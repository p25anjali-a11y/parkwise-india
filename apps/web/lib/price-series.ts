import { DEFAULT_RULES, quote, type PricingRules } from "@parkwise/pricing";
import { resolveOccupancy, type LotKind } from "./resolve-occupancy";
import { eventUpliftFor, signalsFor, withEventUplift, type EventRow, type SignalRow } from "./quote-inputs";
import type { LiveRow } from "./occupancy-input";

export interface SeriesPoint { offsetMin: number; at: string; ratePerHour: number; occupancy: number | null; label: string }

/**
 * Price for each of the next `hours` hours (arriving now, +1h, +2h ...), using the same quote() and occupancy rules as a real quote.
 * Real lots without a forecast or fresh count get occupancy null and the base tariff, exactly as a real quote would.
 */
export function priceSeries(a: {
  lot: LotKind;
  rules?: Partial<PricingRules> | null;
  events: EventRow[];
  signalRows: SignalRow[];
  live: LiveRow | null;
  hours: number;
  rainProbAt: (rows: SignalRow[], at: Date) => number | undefined;
  now?: Date;
}): SeriesPoint[] {
  const now = a.now ?? new Date();
  const rules = { ...DEFAULT_RULES, ...(a.rules ?? {}) } as PricingRules;
  const out: SeriesPoint[] = [];
  for (let h = 0; h < a.hours; h++) {
    const arrival = new Date(now.getTime() + h * 3600_000);
    const uplift = eventUpliftFor(a.events, arrival, 60);
    const occ = resolveOccupancy({ lot: a.lot, forecast: null, live: a.live, arrival, now, rainProb: a.rainProbAt(a.signalRows, arrival), eventImpact: uplift / 0.25 });
    const { signals, inputs } = signalsFor(a.signalRows, arrival, now);
    const q = quote({ lotId: a.lot.id, zoneId: "series", rules: withEventUplift(rules, uplift), predictedOccupancy: occ.value, arrivalTime: arrival, durationMin: 60, signals, inputs: [occ.input, ...inputs] });
    out.push({ offsetMin: h * 60, at: arrival.toISOString(), ratePerHour: q.ratePerHour, occupancy: occ.value, label: q.label });
  }
  return out;
}
