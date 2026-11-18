import { z } from "zod";

export const CATEGORIES = ["mall", "office", "stadium", "hospital", "airport", "hotel", "municipal", "other"] as const;
export const CITIES = ["Mumbai", "Ahmedabad"] as const;

export const lotInput = z.object({
  name: z.string().trim().min(3).max(120),
  city: z.enum(CITIES),
  address: z.string().trim().max(240).optional(),
  category: z.enum(CATEGORIES),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  carCapacity: z.coerce.number().int().min(1).max(20000),
  reservablePct: z.coerce.number().min(0).max(100),
  baseRupeesPerHour: z.coerce.number().min(1).max(5000),
});
export type LotInput = z.infer<typeof lotInput>;

export const rulesInput = z.object({
  baseRupeesPerHour: z.coerce.number().min(1).max(5000),
  floorMultiplier: z.coerce.number().min(0.3).max(1),
  ceilingMultiplier: z.coerce.number().min(1).max(4),
  dynamicEnabled: z.coerce.boolean(),
});
export type RulesInput = z.infer<typeof rulesInput>;

export const rupeesToPaise = (r: number) => Math.round(r * 100);
