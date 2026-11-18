import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { z } from "zod";
import { selectPaymentProvider } from "@parkwise/providers";
import { mapReservationError } from "../../../lib/reservation-errors";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";

const body = z.object({ quoteId: z.string().uuid() });

/** Creates a 15-minute hold from a saved price quote, then opens a payment order for the locked total. */
export async function POST(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "reserve", 10);
  if (tooMany) return tooMany;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in to reserve" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Reservations are not enabled on this deployment yet." }, { status: 503 });

  const { data: r, error } = await admin.rpc("create_hold", { p_user: user.id, p_quote_id: p.data.quoteId, p_hold_minutes: 15 });
  if (error || !r) {
    const m = mapReservationError(error ?? {});
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
  const provider = selectPaymentProvider(process.env);
  try {
    const order = await provider.createOrder(r.total_paise, r.id);
    return NextResponse.json({ reservation: { id: r.id, totalPaise: r.total_paise, holdExpiresAt: r.hold_expires_at, arrivalAt: r.arrival_at }, order, mock: provider.isMock });
  } catch {
    await admin.rpc("cancel_reservation", { p_user: user.id, p_reservation: r.id });
    return NextResponse.json({ error: "Payments are unavailable right now. Your hold was released." }, { status: 502 });
  }
}
