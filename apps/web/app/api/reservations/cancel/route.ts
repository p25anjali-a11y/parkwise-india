import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const p = z.object({ reservationId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not enabled" }, { status: 503 });
  const { data } = await admin.rpc("cancel_reservation", { p_user: user.id, p_reservation: p.data.reservationId });
  // Refunds are not automated yet: a cancelled paid reservation is flagged for manual refund.
  return NextResponse.json({ result: data }, { status: data === "cancelled" ? 200 : 409 });
}
