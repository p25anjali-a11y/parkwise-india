export type Severity = "critical" | "warning" | "info";

export interface AlertInput {
  lotId: string;
  lotName: string;
  occupied: number | null;
  capacity: number | null;
  lastFeedAt: string | null;
  /** Highest probability of being full over the next two hours, from stored forecasts. */
  maxPFullNext2h: number | null;
  /** Current multiplier relative to the configured ceiling, 0..1 (1 = at ceiling). */
  atCeiling?: boolean;
}

export interface Alert {
  lotId: string;
  lotName: string;
  kind: "nearly_full" | "forecast_full" | "feed_stale" | "no_feed" | "price_at_ceiling";
  severity: Severity;
  message: string;
}

const STALE_MIN = 15;

/** Derived on read from current data. Nothing is stored or sent: this is an in-app view, not push or email. */
export function computeAlerts(rows: AlertInput[], now: Date = new Date()): Alert[] {
  const out: Alert[] = [];
  for (const r of rows) {
    const base = { lotId: r.lotId, lotName: r.lotName };
    if (!r.lastFeedAt) {
      out.push({ ...base, kind: "no_feed", severity: "info", message: "No live feed yet. Drivers see your base tariff, not live availability, until a feed connects." });
    } else {
      const ageMin = (now.getTime() - Date.parse(r.lastFeedAt)) / 60_000;
      if (ageMin > STALE_MIN) out.push({ ...base, kind: "feed_stale", severity: ageMin > 60 ? "critical" : "warning", message: `Feed last updated ${Math.round(ageMin)} min ago. Forecasts are widened until it recovers.` });
    }
    if (r.occupied != null && r.capacity) {
      const f = r.occupied / r.capacity;
      if (f >= 0.9) out.push({ ...base, kind: "nearly_full", severity: f >= 0.98 ? "critical" : "warning", message: `${Math.round(f * 100)}% full (${r.occupied}/${r.capacity}).` });
    }
    if (r.maxPFullNext2h != null && r.maxPFullNext2h >= 0.5) out.push({ ...base, kind: "forecast_full", severity: "warning", message: `Forecast: about ${Math.round(r.maxPFullNext2h * 100)}% chance of being full within 2 hours.` });
    if (r.atCeiling) out.push({ ...base, kind: "price_at_ceiling", severity: "info", message: "Dynamic price is at its ceiling. Consider raising the ceiling or adding capacity." });
  }
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
