/**
 * SIMULATED parking occupancy for lots flagged is_synthetic. Not real data and never stored: it is computed on
 * read from the real clock (IST), the real rain probability and real event windows, so simulated lots react to
 * live weather and events while their parking counts are invented. Real lots never use this.
 */
/** Shown to users as the occupancy source. The team marks simulated figures with "*" only (see CLAUDE.md rule 1). */
export const SIMULATION_LABEL = "Occupancy forecast*";
export const SIMULATION_MODEL = "simulated-v1";

const IST_MS = 330 * 60_000;
const BUCKET_MS = 15 * 60_000;

const bump = (h: number, mu: number, sd: number, amp: number) => amp * Math.exp(-((h - mu) ** 2) / (2 * sd * sd));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Stable 0..1 hash of a string (FNV-1a). */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

/** Smooth, deterministic wobble in [-0.5, 0.5): the same lot and time always give the same value. */
function wobble(lotId: string, at: Date): number {
  const t = at.getTime() / BUCKET_MS;
  const b = Math.floor(t);
  const f = t - b;
  const a = hash01(`${lotId}:${b}`);
  const c = hash01(`${lotId}:${b + 1}`);
  return a + (c - a) * f - 0.5;
}

export interface SimInput {
  lotId: string;
  category: string;
  at: Date;
  /** Real rain probability near that time, 0..1. */
  rainProb?: number;
  /** Real event impact near that time, 0..1. */
  eventImpact?: number;
}

/** Simulated fraction of car bays occupied, 0..1. */
export function simulatedOccupancy(i: SimInput): number {
  const ist = new Date(i.at.getTime() + IST_MS);
  const h = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  const dow = ist.getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const rain = clamp01(i.rainProb ?? 0);
  const ev = clamp01(i.eventImpact ?? 0);

  let f: number;
  switch (i.category) {
    case "mall":
      f = weekend ? 0.08 + bump(h, 13, 2.5, 0.5) + bump(h, 18.5, 2.2, 0.55) : 0.06 + bump(h, 13, 2.5, 0.28) + bump(h, 19, 2, 0.4);
      f += ev * bump(h, 19, 2, 0.2) - rain * 0.12 * (h > 10 && h < 22 ? 1 : 0);
      break;
    case "office":
      f = weekend ? 0.06 + bump(h, 12, 3, 0.06) : 0.08 + bump(h, 12, 3.6, 0.82);
      f -= rain * 0.05;
      break;
    case "hospital":
      f = 0.3 + bump(h, 11, weekend ? 3 : 3.2, weekend ? 0.25 : 0.45) + rain * 0.04;
      break;
    case "stadium":
      f = 0.04 + ev * bump(h, 18.5, 1.7, 0.85);
      break;
    default:
      f = 0.2 + bump(h, 13, 4, 0.2);
  }
  return clamp01(f + wobble(i.lotId, i.at) * 0.08);
}
