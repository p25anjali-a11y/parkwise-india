import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { supabaseServer } from "../../../lib/supabase/server";

const body = z.object({
  reservationId: z.string().uuid(),
  note: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).refine((v) => !!v.note || (v.lat !== undefined && v.lng !== undefined), { message: "Add a note or use your location." });

/** Find my car: a note ("Level 2, near pillar B7") and/or the phone's location, saved against a reservation. */
export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "pin", 30);
  if (many) return many;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Add a note or use your location." }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: r } = await sb.from("reservations").select("id").eq("id", p.data.reservationId).eq("user_id", user.id).maybeSingle();
  if (!r) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const { error } = await sb.from("car_pins").upsert({
    reservation_id: p.data.reservationId, user_id: user.id, note: p.data.note ?? null, lat: p.data.lat ?? null, lng: p.data.lng ?? null, updated_at: new Date().toISOString(),
  });
  return error ? NextResponse.json({ error: "Could not save." }, { status: 500 }) : NextResponse.json({ ok: true });
}
