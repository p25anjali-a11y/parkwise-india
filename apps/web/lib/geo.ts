export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const CITY_CENTRES: Record<string, LatLng> = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

export function sortByDistance<T extends LatLng>(items: T[], from: LatLng): (T & { km: number })[] {
  return items.map((i) => ({ ...i, km: haversineKm(from, i) })).sort((x, y) => x.km - y.km);
}

/** Honest availability wording from current occupancy. This is "right now", not a forecast. */
export function availabilityNow(occupied: number, capacity: number): "Likely space" | "Tight" | "Nearly full" {
  const f = capacity > 0 ? occupied / capacity : 1;
  return f < 0.7 ? "Likely space" : f < 0.9 ? "Tight" : "Nearly full";
}
