/** CSV for operator exports. Cells that start with = + - @ are prefixed so spreadsheets do not run them as formulas. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** IST calendar day key (YYYY-MM-DD) for an ISO timestamp. */
export const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Gross paise per IST day for the last n days (oldest first), counting confirmed, checked-in and completed bookings. */
export function dailyGross(rows: { status: string; total_paise: number; created_at: string }[], days: number, now = new Date()): { day: string; paise: number }[] {
  const paid = new Set(["confirmed", "checked_in", "completed"]);
  const out = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) out.set(istDay(new Date(now.getTime() - i * 86_400_000).toISOString()), 0);
  for (const r of rows) {
    if (!paid.has(r.status)) continue;
    const k = istDay(r.created_at);
    if (out.has(k)) out.set(k, out.get(k)! + r.total_paise);
  }
  return [...out].map(([day, paise]) => ({ day, paise }));
}
