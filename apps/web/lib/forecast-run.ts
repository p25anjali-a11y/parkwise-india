import { planForecasts, type LotInput, type Snapshot } from "./forecast-job";
import type { supabaseAdmin } from "./supabase/admin";

type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;
const DAYS = 30;

async function snapshotsFor(admin: Admin, lotId: string, since: string): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from("capacity_snapshots").select("captured_at,occupied").eq("lot_id", lotId).gte("captured_at", since).order("captured_at").range(from, from + 999);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Fits per-lot baseline models from capacity_snapshots and upserts the next 24h of forecasts. */
export async function runForecasts(admin: Admin, now = new Date()): Promise<{ lots: number; rows: number } | { error: string; written: number }> {
  const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString();
  const { data: lots } = await admin.from("lots").select("id,city,category").eq("status", "approved");
  const { data: calendar } = await admin.from("calendar_days").select("starts_on,ends_on,kind,weight");
  const { data: signals } = await admin.from("demand_signals").select("city,kind,value,valid_at");
  const { data: events } = await admin.from("events").select("lot_id,starts_at,ends_at,impact");
  const { data: live } = await admin.from("lot_live_state").select("lot_id,occupied,capacity,updated_at");
  const liveBy = new Map((live ?? []).map((l) => [l.lot_id, l]));

  const inputs: LotInput[] = [];
  for (const l of lots ?? []) {
    const snaps = await snapshotsFor(admin, l.id, since);
    const lv = liveBy.get(l.id);
    const capacity = lv?.capacity ?? 0;
    if (!capacity) continue;
    inputs.push({
      lotId: l.id,
      category: l.category,
      capacity,
      snapshots: snaps,
      live: lv ? { occupied: lv.occupied, asOf: new Date(lv.updated_at) } : undefined,
      ctx: {
        calendar: (calendar ?? []).map((c) => ({ ...c, weight: Number(c.weight) })),
        events: (events ?? []).filter((e) => e.lot_id === l.id),
        rain: (signals ?? []).filter((s) => s.city === l.city),
      },
    });
  }

  const rows = planForecasts(inputs, now, 24);
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("forecasts").upsert(rows.slice(i, i + 500), { onConflict: "lot_id,target_time,model_version" });
    if (error) return { error: error.message, written };
    written += Math.min(500, rows.length - i);
  }
  await admin.from("data_source_health").update({ last_success_at: now.toISOString() }).eq("source", "parking-feed");
  return { lots: inputs.length, rows: written };
}
