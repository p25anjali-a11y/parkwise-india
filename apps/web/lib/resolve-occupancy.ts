import type { ForecastRow } from "./availability";
import { chooseOccupancy, type LiveRow, type OccupancyChoice } from "./occupancy-input";
import { SIMULATION_LABEL, SIMULATION_MODEL, simulatedOccupancy } from "./simulated-occupancy";

export interface LotKind {
  id: string;
  category: string;
  is_synthetic: boolean;
}

/**
 * Occupancy for pricing and display. Simulated lots (is_synthetic) get simulated occupancy, labelled as such.
 * Real lots only ever use fresh real data (see chooseOccupancy); they can never fall back to a simulation.
 */
export function resolveOccupancy(a: {
  lot: LotKind;
  forecast: (ForecastRow & { generated_at?: string | null }) | null;
  live: LiveRow | null;
  arrival: Date;
  now?: Date;
  rainProb?: number;
  eventImpact?: number;
}): OccupancyChoice & { simulated: boolean } {
  const now = a.now ?? new Date();
  if (a.lot.is_synthetic) {
    const value = simulatedOccupancy({ lotId: a.lot.id, category: a.lot.category, at: a.arrival, rainProb: a.rainProb, eventImpact: a.eventImpact });
    return { value, simulated: true, modelVersion: SIMULATION_MODEL, input: { name: "occupancy", status: "used", source: SIMULATION_LABEL, asOf: now.toISOString() } };
  }
  return { ...chooseOccupancy({ forecast: a.forecast, live: a.live, arrival: a.arrival, now }), simulated: false };
}
