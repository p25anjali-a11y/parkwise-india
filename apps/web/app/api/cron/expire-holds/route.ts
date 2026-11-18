import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  const { data, error } = await admin.rpc("expire_holds");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ released: data });
}
