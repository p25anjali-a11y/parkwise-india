import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { supabaseServer } from "../../../lib/supabase/server";

/** Driver asks for a valet on a confirmed booking. Operators accept and finish it. Fees are agreed with the lot, not charged here. */
export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "valet", 20);
  if (many) return many;
  const p = z.object({ reservationId: z.string().uuid(), note: z.string().trim().max(200).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: r } = await sb.from("reservations").select("id,lot_id,status").eq("id", p.data.reservationId).eq("user_id", user.id).maybeSingle();
  if (!r || r.status !== "confirmed") return NextResponse.json({ error: "Valet is available on confirmed bookings." }, { status: 409 });
  const { error } = await sb.from("valet_requests").insert({ reservation_id: r.id, user_id: user.id, lot_id: r.lot_id, note: p.data.note ?? null });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Valet already requested." : "Could not request valet." }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const p = z.object({ id: z.string().uuid(), status: z.enum(["accepted", "done"]) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data, error } = await sb.from("valet_requests").update({ status: p.data.status, updated_at: new Date().toISOString() }).eq("id", p.data.id).select("id");
  if (error || !data?.length) return NextResponse.json({ error: "Not allowed." }, { status: 403 }); // RLS: only the lot's own operators match
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { error } = await sb.from("valet_requests").delete().eq("id", id.data);
  return error ? NextResponse.json({ error: "Could not cancel." }, { status: 500 }) : NextResponse.json({ ok: true });
}
