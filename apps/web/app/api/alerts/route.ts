import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { supabaseServer } from "../../../lib/supabase/server";

const body = z.object({ lotId: z.string().uuid(), targetRupees: z.number().min(1).max(5000) });

export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "alerts", 20);
  if (many) return many;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a price in rupees." }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { error } = await sb.from("price_alerts").upsert(
    { user_id: user.id, lot_id: p.data.lotId, target_rate_paise: Math.round(p.data.targetRupees * 100) },
    { onConflict: "user_id,lot_id" },
  );
  return error ? NextResponse.json({ error: "Could not save the alert." }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { error } = await sb.from("price_alerts").delete().eq("id", id.data);
  return error ? NextResponse.json({ error: "Could not remove." }, { status: 500 }) : NextResponse.json({ ok: true });
}
