export interface Snap {
  captured_at: string;
  occupied: number;
  capacity: number;
}

/** Mean occupancy fraction by IST hour of day (0..23). Hours with no data are null. */
export function hourlyProfile(snaps: Snap[]): (number | null)[] {
  const sum = new Array<number>(24).fill(0);
  const n = new Array<number>(24).fill(0);
  for (const s of snaps) {
    if (!s.capacity) continue;
    const h = new Date(Date.parse(s.captured_at) + 5.5 * 3600_000).getUTCHours();
    sum[h]! += s.occupied / s.capacity;
    n[h]!++;
  }
  return sum.map((v, h) => (n[h] ? Math.round((v / n[h]!) * 1000) / 1000 : null));
}

export interface ResRow {
  status: string;
  total_paise: number;
  duration_min: number;
}

export interface Summary {
  reservations: number;
  confirmed: number;
  /** Paise from confirmed, checked-in or completed reservations. Gross, before any refunds or fees. */
  grossPaise: number;
  conversionPct: number | null;
  cancelledOrExpired: number;
}

export function reservationSummary(rows: ResRow[]): Summary {
  const paid = new Set(["confirmed", "checked_in", "completed"]);
  const confirmed = rows.filter((r) => paid.has(r.status));
  const lost = rows.filter((r) => r.status === "cancelled" || r.status === "expired").length;
  return {
    reservations: rows.length,
    confirmed: confirmed.length,
    grossPaise: confirmed.reduce((a, r) => a + r.total_paise, 0),
    conversionPct: rows.length ? Math.round((confirmed.length / rows.length) * 100) : null,
    cancelledOrExpired: lost,
  };
}

export interface QuoteRow {
  multiplier: number;
}

/** Mean quoted multiplier and the share of quotes priced above standard (> 1.0). */
export function pricingSummary(quotes: QuoteRow[]): { count: number; meanMultiplier: number | null; peakSharePct: number | null } {
  if (!quotes.length) return { count: 0, meanMultiplier: null, peakSharePct: null };
  const mean = quotes.reduce((a, q) => a + Number(q.multiplier), 0) / quotes.length;
  const peak = quotes.filter((q) => Number(q.multiplier) > 1).length;
  return { count: quotes.length, meanMultiplier: Math.round(mean * 100) / 100, peakSharePct: Math.round((peak / quotes.length) * 100) };
}
