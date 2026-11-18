import { NextResponse } from "next/server";
import { selectPaymentProvider } from "@parkwise/providers";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

interface Payload {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; method?: string } }; order?: { entity?: { receipt?: string } } };
}

/** Backup path for payments whose browser callback never arrived. Idempotent via confirm_payment. */
export async function POST(req: Request) {
  const raw = await req.text();
  const provider = selectPaymentProvider(process.env);
  if (provider.isMock || !provider.verifyWebhook(raw, req.headers.get("x-razorpay-signature") ?? "")) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  const j = JSON.parse(raw) as Payload;
  if (j.event !== "order.paid") return NextResponse.json({ ignored: true });
  const pay = j.payload?.payment?.entity;
  const receipt = j.payload?.order?.entity?.receipt;
  const admin = supabaseAdmin();
  if (!pay?.id || !pay.order_id || !receipt || !admin) return NextResponse.json({ error: "unusable payload" }, { status: 400 });
  const { data } = await admin.rpc("confirm_payment", {
    p_reservation: receipt, p_provider: "razorpay", p_order_id: pay.order_id, p_payment_id: pay.id,
    p_amount_paise: pay.amount ?? 0, p_method: pay.method ?? "upi", p_is_test: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") === true, p_raw: j as never,
  });
  return NextResponse.json({ result: data });
}
