import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../../lib/env";
import { limited } from "../../../../lib/rate-limit";
import { normaliseCode } from "../../../../lib/referral";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { supabaseServer } from "../../../../lib/supabase/server";

const body = z.object({ code: z.string().min(1).max(20) });

/** A signed-in user claims the invite code they arrived with. Results: ok, invalid, self, already, late. */
export async function POST(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "refclaim", 10);
  if (tooMany) return tooMany;
  const p = body.safeParse(await req.json().catch(() => null));
  const code = p.success ? normaliseCode(p.data.code) : null;
  if (!code) return NextResponse.json({ result: "invalid" });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not enabled" }, { status: 503 });
  const { data, error } = await admin.rpc("claim_referral", { p_referred: user.id, p_code: code });
  if (error) return NextResponse.json({ error: "could not apply the code" }, { status: 500 });
  return NextResponse.json({ result: data });
}
