import { fitModel, forecastWithModel, istParts, type DayFlags, type LotModel, type Sample } from "@parkwise/forecast";

export interface CalendarRow { starts_on: string; ends_on: string; kind: string; weight: number }
export interface EventRow { starts_at: string; ends_at: string; impact: number | null }
export interface RainRow { kind: string; value: number; valid_at: string }
export interface Snapshot { captured_at: string; occupied: number }

export interface Context {
  calendar: CalendarRow[];
  events: EventRow[];
  /** Rain signals for the lot's city. */
  rain: RainRow[];
}

/** Calendar, event and rain flags for an instant (IST dates). */
export function flagsAt(t: number, ctx: Context): DayFlags {
  const day = istParts(t).dateKey;
  const on = (c: CalendarRow) => c.starts_on <= day && day <= c.ends_on;
  const flags: DayFlags = {};
  if (ctx.calendar.some((c) => c.kind === "holiday" && on(c))) flags.holiday = true;
  if (ctx.calendar.some((c) => c.kind === "festival" && on(c))) flags.festival = true;
  const matchW = Math.max(0, ...ctx.calendar.filter((c) => c.kind === "match" && on(c)).map((c) => c.weight));
  const evW = Math.max(0, ...ctx.events.filter((e) => istParts(Date.parse(e.starts_at)).dateKey === day).map((e) => e.impact ?? 0.5));
  const ev = Math.max(matchW, evW);
  if (ev > 0) flags.event = Math.min(1, ev);
  if (ctx.rain.some((r) => r.kind === "rain_prob" && r.value >= 0.6 && istParts(Date.parse(r.valid_at)).dateKey === day)) flags.rain = true;
  return flags;
}

export function buildSamples(snaps: Snapshot[], ctx: Context): Sample[] {
  return snaps.map((s) => {
    const t = Date.parse(s.captured_at);
    return { t, occupied: s.occupied, flags: flagsAt(t, ctx) };
  });
}

export interface ForecastRow {
  lot_id: string;
  target_time: string;
  p10: number;
  p50: number;
  p90: number;
  p_full: number;
  model_version: string;
  stale: boolean;
  cold_start: boolean;
}

export interface LotInput {
  lotId: string;
  category: string;
  capacity: number;
  snapshots: Snapshot[];
  live?: { occupied: number; asOf: Date };
  ctx: Context;
}

/** Fits every lot (peers = same category) and emits 15-minute forecasts for the next `hours`. Pure: no I/O. */
export function planForecasts(lots: LotInput[], now: Date, hours = 24): ForecastRow[] {
  const solo = new Map<string, LotModel>();
  for (const l of lots) {
    if (l.snapshots.length > 0) solo.set(l.lotId, fitModel(l.lotId, l.capacity, buildSamples(l.snapshots, l.ctx)));
  }
  const rows: ForecastRow[] = [];
  for (const l of lots) {
    const peers = lots.filter((p) => p.category === l.category && p.lotId !== l.lotId && solo.has(p.lotId)).map((p) => solo.get(p.lotId)!);
    if (l.snapshots.length === 0 && peers.length === 0) continue;
    const model = fitModel(l.lotId, l.capacity, buildSamples(l.snapshots, l.ctx), peers);
    const feedAgeMin = l.live ? Math.max(0, (now.getTime() - l.live.asOf.getTime()) / 60_000) : undefined;
    const nowFlags = flagsAt(now.getTime(), l.ctx);
    for (let i = 0; i <= hours * 4; i++) {
      const target = new Date(Math.ceil(now.getTime() / 900_000) * 900_000 + i * 900_000);
      const f = forecastWithModel(model, { lotId: l.lotId, targetTime: target, now, live: l.live, flags: flagsAt(target.getTime(), l.ctx), nowFlags, feedAgeMin });
      rows.push({ lot_id: l.lotId, target_time: f.targetTime, p10: Math.round(f.p10), p50: Math.round(f.p50), p90: Math.round(f.p90), p_full: Math.round(f.pFull * 10000) / 10000, model_version: f.modelVersion, stale: f.stale, cold_start: f.coldStart });
    }
  }
  return rows;
}
