import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../../lib/env";
import { toCsv } from "../../../../lib/csv-export";
import { limited } from "../../../../lib/rate-limit";
import { supabaseServer } from "../../../../lib/supabase/server";

const q = z.object({ lot: z.string().uuid().optional(), days: z.coerce.number().int().min(1).max(90).default(30) });

/** Reservations as CSV for the signed-in operator. Row level security decides which lots are visible. */
export async function GET(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "opexport", 10);
  if (tooMany) return tooMany;
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  if (raw.lot === "all" || raw.lot === "") delete raw.lot;
  const p = q.safeParse(raw);
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const since = new Date(Date.now() - p.data.days * 86_400_000).toISOString();
  let query = sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,created_at,lots(name)").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  if (p.data.lot) query = query.eq("lot_id", p.data.lot);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "could not export" }, { status: 500 });
  const rows = [["reservation_id", "lot", "arrival_at_utc", "duration_min", "status", "total_inr", "created_at_utc"],
    ...(data ?? []).map((r) => [r.id, (r.lots as unknown as { name: string } | null)?.name ?? "", r.arrival_at, r.duration_min, r.status, (r.total_paise / 100).toFixed(2), r.created_at])];
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="parkwise-reservations-${p.data.days}d.csv"`, "Cache-Control": "no-store" } });
}
