import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../../lib/env";
import { limited } from "../../../../lib/rate-limit";
import { CITIES } from "../../../../lib/lot-schema";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { supabaseServer } from "../../../../lib/supabase/server";

const body = z.object({ orgName: z.string().trim().min(2).max(80), city: z.enum(CITIES as unknown as [string, ...string[]]) });

/**
 * A signed-in driver turns their account into an operator account: creates their organisation and links the profile.
 * Role changes are blocked for users in the database, so this uses the service role, only for the caller's own profile.
 * Lots still need a platform admin's approval before drivers see them.
 */
export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const many = limited(req, "operator-join", 10);
  if (many) return many;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter your business name and pick a city." }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server is not configured for operator sign-up." }, { status: 503 });
  const { data: profile } = await admin.from("profiles").select("role,org_id").eq("id", user.id).maybeSingle();
  if (profile && profile.role !== "driver") return NextResponse.json({ ok: true, already: true });
  const { data: org, error: oe } = await admin.from("organizations").insert({ name: p.data.orgName, city: p.data.city }).select("id").single();
  if (oe || !org) return NextResponse.json({ error: "Could not create your business." }, { status: 500 });
  const { error } = await admin.from("profiles").update({ role: "operator_admin", org_id: org.id }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not switch your account." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
