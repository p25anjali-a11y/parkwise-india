import type {
  ConfidenceLabel,
  DayFlags,
  ForecastRequest,
  ForecastResult,
  ForecastService,
  Sample,
} from "./types";
import { daypart, hourOfWeek, istParts } from "./time";

export const MODEL_VERSION = "baseline-how-v1";

const Z80 = 1.2815515655446004;
const FLAGS = ["holiday", "festival", "event", "rain"] as const;
type FlagName = (typeof FLAGS)[number];

const RECENCY_HALF_LIFE_DAYS = 14;
const EFFECT_SHRINK = 8; // pseudo-samples pulling flag effects toward 0
const VAR_SHRINK = 8;
const RESIDUAL_TAU_MIN = 120; // how fast a live deviation from the profile fades
const MOMENTUM_GAIN = 0.25;
const SIGMA_FLOOR = 0.025;
/** Calibrated on the synthetic backtest so the nominal 80% band covers about 80%. Re-tune on real data. */
const SIGMA_SCALE = 1.25;
const COLD_START_DAYS = 14; // days of history at which own profile gets 50% weight
const CONGESTION_COEF = 0.1; // hand-set prior, NOT learned from data

export interface LotModel {
  lotId: string;
  capacity: number;
  /** Mean occupancy fraction by hour-of-week; NaN where unseen. */
  profile: number[];
  /** Residual variance by hour-of-week (shrunk to global). */
  variance: number[];
  /** Additive occupancy effect per flag per daypart. */
  effects: Record<FlagName, number[]>;
  historyDays: number;
  /** 0..1 weight of own history vs peers; 1 = fully own. */
  ownWeight: number;
}

const flagList = (f: DayFlags): FlagName[] => FLAGS.filter((k) => !!f[k]);

function profileOnly(profile: number[], t: number): number {
  const v = profile[hourOfWeek(t)];
  return v !== undefined && !Number.isNaN(v) ? v : NaN;
}

/** Fit a model from history. Optional `peers` (same category) supply a cold-start prior. */
export function fitModel(lotId: string, capacity: number, samples: Sample[], peers: LotModel[] = []): LotModel {
  if (samples.length === 0 && peers.length === 0) throw new Error("no history and no peers");
  const last = samples.reduce((m, s) => Math.max(m, s.t), 0);
  const w = (s: Sample) => Math.pow(0.5, (last - s.t) / 86_400_000 / RECENCY_HALF_LIFE_DAYS);

  const sum = new Array<number>(168).fill(0);
  const wsum = new Array<number>(168).fill(0);
  for (const s of samples) {
    if (flagList(s.flags).length) continue;
    const b = hourOfWeek(s.t);
    const ww = w(s);
    sum[b]! += ww * (s.occupied / capacity);
    wsum[b]! += ww;
  }
  const own = sum.map((v, i) => (wsum[i]! > 0 ? v / wsum[i]! : NaN));

  const days = new Set(samples.map((s) => istParts(s.t).dateKey)).size;
  const ownWeight = peers.length === 0 ? 1 : days / (days + COLD_START_DAYS);

  const peerAvg = (pick: (m: LotModel) => number[]): number[] =>
    Array.from({ length: pick(peers[0] ?? ({} as LotModel)).length || 168 }, (_, i) => {
      const vals = peers.map((p) => pick(p)[i]!).filter((v) => !Number.isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    });

  let profile = own;
  if (peers.length) {
    const pp = peerAvg((m) => m.profile);
    profile = own.map((o, i) => {
      const p = pp[i]!;
      if (Number.isNaN(o)) return p;
      if (Number.isNaN(p)) return o;
      return ownWeight * o + (1 - ownWeight) * p;
    });
  }

  // Residual variance on unflagged samples, shrunk toward the global variance.
  const rs = new Array<number>(168).fill(0);
  const rn = new Array<number>(168).fill(0);
  let gs = 0;
  let gn = 0;
  for (const s of samples) {
    if (flagList(s.flags).length) continue;
    const p = profile[hourOfWeek(s.t)]!;
    if (Number.isNaN(p)) continue;
    const e = s.occupied / capacity - p;
    rs[hourOfWeek(s.t)]! += e * e;
    rn[hourOfWeek(s.t)]!++;
    gs += e * e;
    gn++;
  }
  const globalVar = gn ? gs / gn : 0.02;
  let variance = rs.map((v, i) => (v + VAR_SHRINK * globalVar) / (rn[i]! + VAR_SHRINK));
  if (peers.length && gn === 0) variance = new Array<number>(168).fill(globalVar);

  // Flag effects per daypart, estimated on days where only that flag is set.
  const effects = Object.fromEntries(FLAGS.map((f) => [f, [0, 0, 0, 0]])) as Record<FlagName, number[]>;
  for (const f of FLAGS) {
    for (let dp = 0; dp < 4; dp++) {
      let num = 0;
      let n = 0;
      for (const s of samples) {
        const fl = flagList(s.flags);
        if (fl.length !== 1 || fl[0] !== f || daypart(s.t) !== dp) continue;
        const p = profile[hourOfWeek(s.t)]!;
        if (Number.isNaN(p)) continue;
        num += s.occupied / capacity - p;
        n++;
      }
      effects[f][dp] = n ? num / (n + EFFECT_SHRINK) : 0;
    }
  }
  if (peers.length && days < 3) {
    for (const f of FLAGS) {
      effects[f] = [0, 1, 2, 3].map((dp) => {
        const vals = peers.map((p) => p.effects[f][dp]!);
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      });
    }
  }

  return { lotId, capacity, profile, variance, effects, historyDays: days, ownWeight };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function expectedOcc(m: LotModel, t: number, flags: DayFlags): number {
  let p = profileOnly(m.profile, t);
  if (Number.isNaN(p)) {
    const vals = m.profile.filter((v) => !Number.isNaN(v));
    p = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
  }
  const dp = daypart(t);
  for (const f of FLAGS) {
    const v = flags[f];
    if (v) p += m.effects[f][dp]! * (typeof v === "number" ? v : 1);
  }
  return p;
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). */
export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function confidenceLabel(p10: number, pFull: number, capacity: number): ConfidenceLabel {
  if (pFull >= 0.5) return "Probably full";
  if (pFull >= 0.15 || p10 <= Math.max(1, Math.round(capacity * 0.05))) return "Tight";
  return "Likely space";
}

export function forecastWithModel(m: LotModel, req: ForecastRequest): ForecastResult {
  const target = req.targetTime.getTime();
  const flags = req.flags ?? {};
  let mean = expectedOcc(m, target, flags);
  const cong = req.congestionIndex ?? 0;
  mean += CONGESTION_COEF * Math.max(0, cong - 0.5) * 2;

  const bucketVar = m.variance[hourOfWeek(target)] ?? 0.02;
  let variance = bucketVar;
  const feedAge = req.feedAgeMin ?? 0;
  // Stale or absent live data: fall back to profile uncertainty.
  const stale = !req.live || feedAge > 15;

  if (req.live && !stale) {
    const asOf = req.live.asOf.getTime();
    const h = Math.max(0, (target - asOf) / 60_000) + feedAge;
    const rho = Math.exp(-h / RESIDUAL_TAU_MIN);
    const liveFrac = req.live.occupied / m.capacity;
    const baseNow = expectedOcc(m, asOf, req.nowFlags ?? flags);
    mean += rho * (liveFrac - baseNow);
    if (req.live.momentumPerHour !== undefined) {
      mean += MOMENTUM_GAIN * req.live.momentumPerHour * Math.min(h / 60, 1) * rho;
    }
    variance = bucketVar * (1 - rho * rho) + 0.02 * 0.02;
  } else if (req.live && stale) {
    // Last count is old: use it lightly, widen the band.
    variance = bucketVar * (1 + Math.min(feedAge / 60, 1));
  }

  // Cold start: widen while we lean on peers.
  variance *= 1 + (1 - m.ownWeight);
  const sigma = Math.max(SIGMA_FLOOR, Math.sqrt(variance) * SIGMA_SCALE);
  mean = clamp01(mean);

  const cap = m.capacity;
  const free = (occ: number) => Math.min(cap, Math.max(0, cap * (1 - occ)));
  const p10 = free(mean + Z80 * sigma);
  const p50 = free(mean);
  const p90 = free(mean - Z80 * sigma);
  const fullThreshold = (cap - 0.5) / cap;
  const pFull = 1 - normCdf((fullThreshold - mean) / sigma);

  return {
    lotId: m.lotId,
    targetTime: req.targetTime.toISOString(),
    capacity: cap,
    p10: Math.round(p10),
    p50: Math.round(p50),
    p90: Math.round(p90),
    pFull: Math.round(pFull * 1000) / 1000,
    confidence: confidenceLabel(p10, pFull, cap),
    modelVersion: MODEL_VERSION,
    coldStart: m.ownWeight < 0.75,
    stale,
  };
}

export class BaselineForecastService implements ForecastService {
  constructor(private readonly models: Map<string, LotModel>) {}
  async forecast(req: ForecastRequest): Promise<ForecastResult> {
    const m = this.models.get(req.lotId);
    if (!m) throw new Error(`no forecast model for lot ${req.lotId}`);
    return forecastWithModel(m, req);
  }
}
