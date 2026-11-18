export interface CalendarRowInput {
  starts_on: string;
  ends_on: string;
  name: string;
  kind: "holiday" | "festival" | "school_holiday" | "match";
  weight: number;
}

export interface EventRowInput {
  city: string;
  name: string;
  venue: string | null;
  starts_at: string;
  ends_at: string;
  expected_attendance: number | null;
  impact: number;
}

const KINDS = new Set(["holiday", "festival", "school_holiday", "match"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function splitCsv(text: string): string[][] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.split(",").map((c) => c.trim()));
}

export interface ParseResult<T> {
  rows: T[];
  errors: string[];
}

/** CSV columns: starts_on,ends_on,name,kind[,weight]. Dates YYYY-MM-DD. Lines starting # are ignored. */
export function parseCalendarCsv(text: string): ParseResult<CalendarRowInput> {
  const lines = splitCsv(text);
  const rows: CalendarRowInput[] = [];
  const errors: string[] = [];
  lines.forEach((c, i) => {
    if (i === 0 && c[0] === "starts_on") return;
    const [s, e, name, kind, w] = c;
    if (!s || !e || !name || !kind) return void errors.push(`line ${i + 1}: need starts_on,ends_on,name,kind`);
    if (!DATE.test(s) || !DATE.test(e) || e < s) return void errors.push(`line ${i + 1}: bad dates`);
    if (!KINDS.has(kind)) return void errors.push(`line ${i + 1}: unknown kind ${kind}`);
    const weight = w === undefined || w === "" ? 1 : Number(w);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) return void errors.push(`line ${i + 1}: weight must be 0..1`);
    rows.push({ starts_on: s, ends_on: e, name, kind: kind as CalendarRowInput["kind"], weight });
  });
  return { rows, errors };
}

/** CSV columns: city,name,venue,starts_at,ends_at,expected_attendance,impact. Timestamps ISO 8601 with offset. */
export function parseEventsCsv(text: string): ParseResult<EventRowInput> {
  const lines = splitCsv(text);
  const rows: EventRowInput[] = [];
  const errors: string[] = [];
  lines.forEach((c, i) => {
    if (i === 0 && c[0] === "city") return;
    const [city, name, venue, s, e, att, imp] = c;
    if (!city || !name || !s || !e) return void errors.push(`line ${i + 1}: need city,name,venue,starts_at,ends_at`);
    const a = Date.parse(s);
    const b = Date.parse(e);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return void errors.push(`line ${i + 1}: bad timestamps`);
    const impact = imp === undefined || imp === "" ? 0.5 : Number(imp);
    if (!Number.isFinite(impact) || impact < 0 || impact > 1) return void errors.push(`line ${i + 1}: impact must be 0..1`);
    const attendance = att ? Number(att) : null;
    rows.push({ city, name, venue: venue || null, starts_at: new Date(a).toISOString(), ends_at: new Date(b).toISOString(), expected_attendance: attendance && Number.isFinite(attendance) ? Math.round(attendance) : null, impact });
  });
  return { rows, errors };
}
