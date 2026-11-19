export interface HourPoint { at: string; occupancy: number; ratePerHour: number }

/** Rough hourly revenue estimate: occupied spaces x that hour's rate. Assumes every parked car pays the going rate. */
export function forecastRevenue(points: HourPoint[], capacity: number): { hours: { at: string; expectedPaise: number }[]; totalPaise: number } {
  const hours = points.map((p) => ({ at: p.at, expectedPaise: Math.round(Math.min(1, Math.max(0, p.occupancy)) * capacity * p.ratePerHour) }));
  return { hours, totalPaise: hours.reduce((n, h) => n + h.expectedPaise, 0) };
}
