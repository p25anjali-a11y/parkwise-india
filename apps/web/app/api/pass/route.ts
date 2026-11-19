import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { verifyPass } from "../../../lib/pass";
import { canAccess, type Role } from "../../../lib/roles";
import { supabaseServer } from "../../../lib/supabase/server";

/** Gate staff scan a pass: operators and admins only. Returns whether the booking is valid and for which lot and time. */
export async function GET(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "pass", 60);
  if (many) return many;
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!user || !canAccess((profile?.role as Role) ?? null, "operator")) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const id = verifyPass(new URL(req.url).searchParams.get("code") ?? "", secret);
  if (!id) return NextResponse.json({ valid: false, reason: "Not a genuine Parkwise pass." });
  const { data: r } = await sb.from("reservations").select("status,arrival_at,duration_min,lots(name)").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ valid: false, reason: "Booking not found for your lots." });
  return NextResponse.json({ valid: r.status === "confirmed", status: r.status, arrivalAt: r.arrival_at, durationMin: r.duration_min, lot: (r.lots as unknown as { name: string } | null)?.name });
}
