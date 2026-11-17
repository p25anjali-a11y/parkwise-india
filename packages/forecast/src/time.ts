const IST_OFFSET_MS = 5.5 * 3600_000;
export const STEP_MIN = 15;
export const STEP_MS = STEP_MIN * 60_000;

export interface IstParts {
  /** 0 = Monday .. 6 = Sunday */
  dow: number;
  hour: number;
  minute: number;
  dateKey: string;
}

export function istParts(t: number): IstParts {
  const d = new Date(t + IST_OFFSET_MS);
  return {
    dow: (d.getUTCDay() + 6) % 7,
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    dateKey: d.toISOString().slice(0, 10),
  };
}

/** Hour-of-week bucket, 0..167 (Mon 00:00 IST = 0). */
export function hourOfWeek(t: number): number {
  const p = istParts(t);
  return p.dow * 24 + p.hour;
}

/** 0 night, 1 morning, 2 afternoon, 3 evening. */
export function daypart(t: number): number {
  const h = istParts(t).hour;
  return h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
}

/** Epoch ms of 00:00 IST for a YYYY-MM-DD date. */
export function istMidnight(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00Z`) - IST_OFFSET_MS;
}
