import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { supabaseServer } from "../../../lib/supabase/server";

const body = z.object({ model: z.string().trim().min(2).max(40), plate: z.string().trim().min(6).max(14) });

/** Saved cars. Only a hash and the last four characters of the plate are stored, never the full plate. */
export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "vehicles", 20);
  if (many) return many;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a car model and a number plate." }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const plate = p.data.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length < 6) return NextResponse.json({ error: "That number plate looks too short." }, { status: 400 });
  const { error } = await sb.from("vehicles").insert({
    user_id: user.id, plate_hash: createHash("sha256").update(plate).digest("hex"), plate_last4: plate.slice(-4), label: p.data.model,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That car is already saved." : "Could not save the car." }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { error } = await sb.from("vehicles").delete().eq("id", id.data); // RLS limits this to the caller's own rows
  return error ? NextResponse.json({ error: "Could not remove." }, { status: 500 }) : NextResponse.json({ ok: true });
}
