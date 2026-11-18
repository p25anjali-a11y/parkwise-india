import type { DemandSignals, PricingRules } from "@parkwise/pricing";

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
  valid_at: string;
}

/** Rain counts when a rain probability of 0.6 or more is valid within three hours of arrival. */
export function signalsFor(rows: SignalRow[], arrival: Date): DemandSignals {
  const near = rows.filter((r) => Math.abs(new Date(r.valid_at).getTime() - arrival.getTime()) <= 3 * 3600_000);
  const rain = near.some((r) => r.kind === "rain_prob" && r.value >= 0.6);
  const cong = near.filter((r) => r.kind === "congestion").map((r) => r.value);
  return { rain, congestionIndex: cong.length ? Math.max(...cong) : undefined };
}

export function withEventUplift(rules: PricingRules, uplift: number): PricingRules {
  return uplift > 0 ? { ...rules, eventUplift: Math.max(rules.eventUplift ?? 0, uplift) } : rules;
}
