import { NextResponse } from "next/server";
import { runIngestion, type SignalStore } from "@parkwise/ingestion";
import { selectTrafficProvider, selectWeatherProvider } from "@parkwise/providers";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export const maxDuration = 60;

/** Pulls weather (Open-Meteo, no key) and traffic (TomTom, only if TOMTOM_API_KEY is set) into demand_signals. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });

  const { data: lots } = await admin.from("lots").select("id,city,lat,lng").eq("status", "approved");
  const store: SignalStore = {
    async replaceCityForecast(source, city, from, rows) {
      await admin.from("demand_signals").delete().eq("source", source).eq("city", city).is("lot_id", null).gte("valid_at", from.toISOString());
      if (rows.length) await admin.from("demand_signals").insert(rows as never);
    },
    async replaceLotReading(source, lotId, row) {
      await admin.from("demand_signals").delete().eq("source", source).eq("lot_id", lotId).eq("kind", "congestion");
      await admin.from("demand_signals").insert(row as never);
    },
    async recordHealth(source, ok, isMock, error) {
      const now = new Date().toISOString();
      const { data: cur } = await admin.from("data_source_health").select("success_count,error_count").eq("source", source).maybeSingle();
      await admin.from("data_source_health").update({
        is_mock: isMock, updated_at: now,
        ...(ok ? { last_success_at: now, success_count: (cur?.success_count ?? 0) + 1 } : { last_error_at: now, last_error: error ?? "error", error_count: (cur?.error_count ?? 0) + 1 }),
      }).eq("source", source);
    },
  };
  const report = await runIngestion({ weather: selectWeatherProvider(), traffic: selectTrafficProvider(process.env), store, lots: lots ?? [] });
  return NextResponse.json(report);
}
