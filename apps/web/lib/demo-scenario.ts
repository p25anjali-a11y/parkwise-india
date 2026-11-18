export type Scenario = "busy_saturday" | "ipl_night";

export interface DemoLot {
  id: string;
  city: string;
  category: string;
  capacity: number;
  isSynthetic: boolean;
}

export interface ScenarioPlan {
  live: { lot_id: string; occupied: number }[];
  events: { lot_id: string; city: string; name: string; venue: string; starts_at: string; ends_at: string; impact: number; source: "demo-sim"; is_synthetic: true }[];
  signals: { city: string; kind: "rain_prob"; value: number; valid_at: string; source: "demo-sim"; is_mock: true }[];
}

/** Target occupancy fraction per category and scenario. Demo values, not measurements. */
const LEVELS: Record<Scenario, Record<string, number>> = {
  busy_saturday: { mall: 0.93, office: 0.12, hospital: 0.55, stadium: 0.1 },
  ipl_night: { stadium: 0.96, mall: 0.82, office: 0.1, hospital: 0.5 },
};

const IST = 5.5 * 3600_000;

/** Today 19:30-23:30 IST as UTC instants. */
export function tonightWindow(now: Date): { start: Date; end: Date } {
  const istDay = new Date(now.getTime() + IST);
  const base = Date.UTC(istDay.getUTCFullYear(), istDay.getUTCMonth(), istDay.getUTCDate()) - IST;
  return { start: new Date(base + 19.5 * 3600_000), end: new Date(base + 23.5 * 3600_000) };
}

/** Pure: decides what the simulation writes. Only synthetic lots are ever touched. */
export function planScenario(lots: DemoLot[], scenario: Scenario, now: Date = new Date()): ScenarioPlan {
  const synth = lots.filter((l) => l.isSynthetic);
  const live = synth.map((l) => ({ lot_id: l.id, occupied: Math.round(l.capacity * (LEVELS[scenario][l.category] ?? 0.4)) }));
  const events: ScenarioPlan["events"] = [];
  const signals: ScenarioPlan["signals"] = [];
  const { start, end } = tonightWindow(now);
  if (scenario === "ipl_night") {
    for (const l of synth.filter((x) => x.category === "stadium")) {
      events.push({ lot_id: l.id, city: l.city, name: "Simulated IPL-style match (demo)", venue: "demo", starts_at: start.toISOString(), ends_at: end.toISOString(), impact: 0.95, source: "demo-sim", is_synthetic: true });
    }
  }
  if (scenario === "busy_saturday") {
    for (const city of new Set(synth.map((l) => l.city))) {
      signals.push({ city, kind: "rain_prob", value: 0.8, valid_at: start.toISOString(), source: "demo-sim", is_mock: true });
    }
  }
  return { live, events, signals };
}
