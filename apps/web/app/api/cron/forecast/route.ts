import { NextResponse } from "next/server";
import { runForecasts } from "../../../../lib/forecast-run";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export const maxDuration = 60;

/** Needs CRON_SECRET and the service-role key. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  const out = await runForecasts(admin);
  return "error" in out ? NextResponse.json(out, { status: 500 }) : NextResponse.json({ ...out, generatedAt: new Date().toISOString() });
}
