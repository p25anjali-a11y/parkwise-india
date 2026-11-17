import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { demoCalendar, generateLot, type LotSpec } from "./synthetic";
import { fitModel, forecastWithModel, type LotModel } from "./model";
import { STEP_MS, istParts } from "./time";
import type { DayFlags, Sample } from "./types";

export const HORIZONS = [15, 30, 60, 120] as const;
const TRAIN_DAYS = 42;
const TOTAL_DAYS = 60;
const START = "2026-09-01";

export const LOTS: LotSpec[] = [
  { id: "mall-a", category: "mall", capacity: 600 },
  { id: "mall-b", category: "mall", capacity: 350 },
  { id: "office-a", category: "office", capacity: 400 },
  { id: "office-b", category: "office", capacity: 250 },
  { id: "hospital-a", category: "hospital", capacity: 180 },
  { id: "stadium-a", category: "stadium", capacity: 900 },
];

export interface HorizonMetrics {
  horizonMin: number;
  n: number;
  mae: number;
  /** MAE as a fraction of capacity, so lots of different sizes are comparable. */
  nmae: number;
  coverage80: number;
  brierFull: number;
  /** MAE of the naive "same as now" persistence forecast, for context. */
  persistenceNmae: number;
}

export interface BacktestReport {
  warm: HorizonMetrics[];
  /** Lot with only 5 days of history, borrowing its category peers. */
  cold: HorizonMetrics[];
  eventDays: HorizonMetrics[];
}

function flagsAt(samples: Sample[], idx: number): DayFlags {
  return samples[idx]!.flags;
}

function evaluate(
  spec: LotSpec,
  all: Sample[],
  model: LotModel,
  testFrom: number,
  filter: (f: DayFlags) => boolean = () => true,
): Map<number, { ae: number; cap: number; cov: number; brier: number; pae: number; n: number }> {
  const acc = new Map<number, { ae: number; cap: number; cov: number; brier: number; pae: number; n: number }>();
  for (const h of HORIZONS) acc.set(h, { ae: 0, cap: spec.capacity, cov: 0, brier: 0, pae: 0, n: 0 });
  const stepsPerHour = 4;
  for (let i = testFrom; i < all.length; i++) {
    const hour = istParts(all[i]!.t).hour;
    const minute = istParts(all[i]!.t).minute;
    if (hour < 7 || hour > 21 || minute % 30 !== 0) continue; // origins every 30 min, 07:00-21:30 IST
    const now = all[i]!;
    const momentum = (now.occupied - all[i - stepsPerHour]!.occupied) / spec.capacity;
    for (const h of HORIZONS) {
      const j = i + h / (STEP_MS / 60_000);
      const tgt = all[j];
      if (!tgt || !filter(flagsAt(all, j))) continue;
      const res = forecastWithModel(model, {
        lotId: spec.id,
        targetTime: new Date(tgt.t),
        live: { occupied: now.occupied, asOf: new Date(now.t), momentumPerHour: momentum },
        flags: tgt.flags,
        nowFlags: now.flags,
      });
      const trueFree = spec.capacity - tgt.occupied;
      const a = acc.get(h)!;
      a.ae += Math.abs(res.p50 - trueFree);
      a.pae += Math.abs(spec.capacity - now.occupied - trueFree);
      a.cov += trueFree >= res.p10 && trueFree <= res.p90 ? 1 : 0;
      a.brier += (res.pFull - (trueFree === 0 ? 1 : 0)) ** 2;
      a.n++;
    }
  }
  return acc;
}

function merge(parts: ReturnType<typeof evaluate>[], caps: number[]): HorizonMetrics[] {
  return HORIZONS.map((h) => {
    let n = 0, mae = 0, nmae = 0, cov = 0, brier = 0, pn = 0;
    parts.forEach((p, k) => {
      const a = p.get(h)!;
      n += a.n;
      mae += a.ae;
      nmae += a.ae / caps[k]!;
      cov += a.cov;
      brier += a.brier;
      pn += a.pae / caps[k]!;
    });
    return {
      horizonMin: h,
      n,
      mae: n ? mae / n : 0,
      nmae: n ? nmae / n : 0,
      coverage80: n ? cov / n : 0,
      brierFull: n ? brier / n : 0,
      persistenceNmae: n ? pn / n : 0,
    };
  });
}

export function runBacktest(seed = 7): BacktestReport {
  const cal = demoCalendar();
  const data = LOTS.map((spec, k) => ({ spec, all: generateLot(spec, START, TOTAL_DAYS, cal, seed * 100 + k) }));
  const perDay = 96;
  const trainEnd = TRAIN_DAYS * perDay;

  const models = data.map(({ spec, all }) => fitModel(spec.id, spec.capacity, all.slice(0, trainEnd)));
  const warm = data.map(({ spec, all }, k) => evaluate(spec, all, models[k]!, trainEnd));
  const caps = LOTS.map((l) => l.capacity);

  const eventDays = data.map(({ spec, all }, k) =>
    evaluate(spec, all, models[k]!, trainEnd, (f) => !!(f.event || f.festival || f.rain || f.holiday)),
  );

  // Cold start: mall-b with only the last 5 training days, peers = other warm models of the same category.
  const coldIdx = LOTS.findIndex((l) => l.id === "mall-b");
  const cold = data[coldIdx]!;
  const coldSamples = cold.all.slice(trainEnd - 5 * perDay, trainEnd);
  const peers = data.filter((d) => d.spec.category === "mall" && d.spec.id !== "mall-b").map((d) => models[LOTS.indexOf(d.spec)]!);
  const coldModel = fitModel(cold.spec.id, cold.spec.capacity, coldSamples, peers);
  const coldEval = evaluate(cold.spec, cold.all, coldModel, trainEnd);

  return {
    warm: merge(warm, caps),
    cold: merge([coldEval], [cold.spec.capacity]),
    eventDays: merge(eventDays, caps),
  };
}

export interface Thresholds {
  maxNmae: Record<string, number>;
  maxNmaeEvent: Record<string, number>;
  maxNmaeCold: Record<string, number>;
  coverageMin: number;
  coverageMax: number;
  maxBrier: number;
}

export function checkThresholds(r: BacktestReport, t: Thresholds): string[] {
  const fails: string[] = [];
  for (const m of r.warm) {
    if (m.nmae > t.maxNmae[m.horizonMin]!) fails.push(`warm nMAE@${m.horizonMin}m ${m.nmae.toFixed(4)} > ${t.maxNmae[m.horizonMin]}`);
    if (m.coverage80 < t.coverageMin || m.coverage80 > t.coverageMax)
      fails.push(`warm coverage@${m.horizonMin}m ${m.coverage80.toFixed(3)} outside [${t.coverageMin}, ${t.coverageMax}]`);
    if (m.brierFull > t.maxBrier) fails.push(`warm Brier@${m.horizonMin}m ${m.brierFull.toFixed(4)} > ${t.maxBrier}`);
  }
  for (const m of r.eventDays) {
    if (m.nmae > t.maxNmaeEvent[m.horizonMin]!) fails.push(`event-day nMAE@${m.horizonMin}m ${m.nmae.toFixed(4)} > ${t.maxNmaeEvent[m.horizonMin]}`);
  }
  for (const m of r.cold) {
    if (m.nmae > t.maxNmaeCold[m.horizonMin]!) fails.push(`cold nMAE@${m.horizonMin}m ${m.nmae.toFixed(4)} > ${t.maxNmaeCold[m.horizonMin]}`);
  }
  return fails;
}

function table(title: string, rows: HorizonMetrics[]): string {
  const lines = [
    `${title}`,
    "horizon  n      MAE(slots)  nMAE    persist-nMAE  cov80   Brier(full)",
    ...rows.map(
      (m) =>
        `${String(m.horizonMin).padEnd(8)} ${String(m.n).padEnd(6)} ${m.mae.toFixed(1).padEnd(11)} ${m.nmae.toFixed(4).padEnd(7)} ${m.persistenceNmae.toFixed(4).padEnd(13)} ${m.coverage80.toFixed(3).padEnd(7)} ${m.brierFull.toFixed(4)}`,
    ),
  ];
  return lines.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const report = runBacktest();
  console.log("SYNTHETIC DATA BACKTEST (no real occupancy involved)\n");
  console.log(table("Warm lots, all test days", report.warm));
  console.log("\n" + table("Warm lots, event/festival/rain/holiday days only", report.eventDays));
  console.log("\n" + table("Cold-start lot (5 days history + peers)", report.cold));
  writeFileSync(join(here, "../backtest-report.json"), JSON.stringify(report, null, 2));
  const thresholds = JSON.parse(readFileSync(join(here, "../thresholds.json"), "utf8")) as Thresholds;
  const fails = checkThresholds(report, thresholds);
  if (fails.length) {
    console.error("\nBACKTEST REGRESSION:\n" + fails.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
  console.log("\nBacktest within thresholds.");
}
