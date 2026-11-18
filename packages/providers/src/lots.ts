import type { ParseResult } from "./calendar";

export interface LotRowInput {
  name: string;
  city: "Mumbai" | "Ahmedabad";
  address: string;
  category: "mall" | "office" | "stadium" | "hospital" | "airport" | "hotel" | "municipal" | "other";
  lat: number;
  lng: number;
  car_capacity: number;
  base_rate_paise: number;
  municipal_cap_paise: number | null;
  operator: string;
  data_source: string;
  data_as_of: string;
}

export const LOT_CSV_HEADER = "name,city,address,category,lat,lng,car_capacity,base_rate_inr_per_hour,municipal_cap_inr_per_hour,operator,data_source,data_as_of";

const CATEGORIES = new Set(["mall", "office", "stadium", "hospital", "airport", "hotel", "municipal", "other"]);
/** Rough city boxes, to catch swapped or mistyped coordinates. */
const BOX: Record<string, { lat: [number, number]; lng: [number, number] }> = {
  Mumbai: { lat: [18.85, 19.4], lng: [72.75, 73.1] },
  Ahmedabad: { lat: [22.85, 23.3], lng: [72.4, 72.8] },
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 200;

/** Splits one CSV line, honouring double quotes so addresses may contain commas. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Real lots only. Every row must say where its facts came from (data_source) and when (data_as_of, YYYY-MM-DD),
 * so the app can show it. Money is entered in rupees and stored as paise. Lines starting # are ignored.
 */
export function parseLotsCsv(text: string, today: Date = new Date()): ParseResult<LotRowInput> {
  const rows: LotRowInput[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length > MAX_ROWS + 1) return { rows, errors: [`at most ${MAX_ROWS} lots per import`] };
  const todayStr = today.toISOString().slice(0, 10);
  lines.forEach((l, i) => {
    const c = splitLine(l);
    if (i === 0 && c[0] === "name") return;
    const at = `line ${i + 1}`;
    if (c.length !== 12) return void errors.push(`${at}: expected 12 columns (${LOT_CSV_HEADER}), got ${c.length}`);
    const [name, city, address, category, lat, lng, cap, rate, cap2, operator, source, asOf] = c as [string, string, string, string, string, string, string, string, string, string, string, string];
    if (!name) return void errors.push(`${at}: name is required`);
    if (city !== "Mumbai" && city !== "Ahmedabad") return void errors.push(`${at}: city must be Mumbai or Ahmedabad`);
    if (!CATEGORIES.has(category)) return void errors.push(`${at}: category must be one of ${[...CATEGORIES].join(", ")}`);
    const la = Number(lat), lo = Number(lng);
    const box = BOX[city]!;
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < box.lat[0] || la > box.lat[1] || lo < box.lng[0] || lo > box.lng[1]) return void errors.push(`${at}: lat/lng are not inside ${city}`);
    const capacity = Number(cap);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return void errors.push(`${at}: car_capacity must be a whole number from 1 to 10000`);
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0 || r > 2000) return void errors.push(`${at}: base_rate_inr_per_hour must be above 0 and at most 2000`);
    let capPaise: number | null = null;
    if (cap2 !== "") {
      const m = Number(cap2);
      if (!Number.isFinite(m) || m < r || m > 5000) return void errors.push(`${at}: municipal_cap_inr_per_hour must be at least the base rate and at most 5000`);
      capPaise = Math.round(m * 100);
    }
    if (!operator) return void errors.push(`${at}: operator is required`);
    if (!source) return void errors.push(`${at}: data_source is required (where these facts came from)`);
    if (!DATE.test(asOf) || Number.isNaN(Date.parse(asOf))) return void errors.push(`${at}: data_as_of must be YYYY-MM-DD`);
    if (asOf > todayStr) return void errors.push(`${at}: data_as_of is in the future`);
    rows.push({ name, city, address, category: category as LotRowInput["category"], lat: la, lng: lo, car_capacity: capacity, base_rate_paise: Math.round(r * 100), municipal_cap_paise: capPaise, operator, data_source: source, data_as_of: asOf });
  });
  return { rows, errors };
}
