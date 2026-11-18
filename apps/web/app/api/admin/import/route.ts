import { NextResponse } from "next/server";
import { parseCalendarCsv, parseEventsCsv } from "@parkwise/providers";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { supabaseServer } from "../../../../lib/supabase/server";

/** Platform admins import calendar days or events from CSV. Dates must be checked against an official source by the admin. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "platform_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not enabled" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { kind?: string; csv?: string } | null;
  if (!body?.csv || (body.kind !== "calendar" && body.kind !== "events") || body.csv.length > 200_000) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body.kind === "calendar") {
    const r = parseCalendarCsv(body.csv);
    if (r.errors.length) return NextResponse.json({ errors: r.errors }, { status: 422 });
    const { error } = await admin.from("calendar_days").insert(r.rows.map((x) => ({ ...x, created_by: user.id, is_synthetic: false })));
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ imported: r.rows.length });
  }
  const r = parseEventsCsv(body.csv);
  if (r.errors.length) return NextResponse.json({ errors: r.errors }, { status: 422 });
  const { error } = await admin.from("events").insert(r.rows.map((x) => ({ ...x, source: "csv-import", is_synthetic: false })));
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ imported: r.rows.length });
}
