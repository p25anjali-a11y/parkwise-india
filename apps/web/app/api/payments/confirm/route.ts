import { NextResponse } from "next/server";
import { z } from "zod";
import { selectPaymentProvider } from "@parkwise/providers";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { supabaseServer } from "../../../../lib/supabase/server";

const body = z.object({ reservationId: z.string().uuid(), orderId: z.string().min(5), paymentId: z.string().min(5), signature: z.string().min(10), method: z.string().max(20).optional() });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const provider = selectPaymentProvider(process.env);
  if (!provider.verifyCheckout(p.data.orderId, p.data.paymentId, p.data.signature)) return NextResponse.json({ error: "payment signature invalid" }, { status: 400 });

  // Ownership via RLS: the driver can only read their own reservations.
  const { data: r } = await sb.from("reservations").select("id,total_paise").eq("id", p.data.reservationId).maybeSingle();
  if (!r) return NextResponse.json({ error: "reservation not found" }, { status: 404 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not enabled" }, { status: 503 });
  const { data, error } = await admin.rpc("confirm_payment", {
    p_reservation: r.id, p_provider: provider.name, p_order_id: p.data.orderId, p_payment_id: p.data.paymentId,
    p_amount_paise: r.total_paise, p_method: p.data.method ?? "upi", p_is_test: provider.isMock || process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") === true, p_raw: null,
  });
  if (error) return NextResponse.json({ error: "could not record payment" }, { status: 500 });
  return NextResponse.json({ result: data });
}
