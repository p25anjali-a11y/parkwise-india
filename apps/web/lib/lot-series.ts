import type { SupabaseClient } from "@supabase/supabase-js";
import { liveTrafficRows, liveWeatherRows, rainProbAt } from "./live-signals";
import { priceSeries, type SeriesPoint } from "./price-series";

/** Loads one lot's inputs and returns its hourly price series plus its capacity. Null when the lot is not visible. */
export async function loadSeries(sb: SupabaseClient, lotId: string, hours: number): Promise<{ name: string; capacity: number; simulated: boolean; series: SeriesPoint[] } | null> {
  const { data: lot } = await sb.from("lots").select("id,name,city,category,lat,lng,is_synthetic").eq("id", lotId).maybeSingle();
  if (!lot) return null;
  const now = new Date();
  const [{ data: live }, { data: rr }, { data: events }, { data: zones }, wx, tr] = await Promise.all([
    sb.from("lot_live_state").select("occupied,capacity,updated_at,source,is_synthetic").eq("lot_id", lotId).maybeSingle(),
    sb.from("price_rules").select("rules").eq("lot_id", lotId).eq("active", true).is("zone_id", null).maybeSingle(),
    sb.from("events").select("starts_at,ends_at,impact").eq("lot_id", lotId),
    sb.from("zones").select("capacity").eq("lot_id", lotId),
    liveWeatherRows(lot.city, now),
    liveTrafficRows({ lat: lot.lat, lng: lot.lng }, now),
  ]);
  const capacity = live?.capacity ?? (zones ?? []).reduce((n: number, z: { capacity: number }) => n + z.capacity, 0);
  const series = priceSeries({ lot, rules: rr?.rules as never, events: events ?? [], signalRows: [...wx, ...tr], live: live ?? null, hours, rainProbAt, now });
  return { name: lot.name, capacity, simulated: lot.is_synthetic, series };
}
