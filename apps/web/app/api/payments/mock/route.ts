import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../../lib/env";
import { z } from "zod";
import { MockPaymentProvider, selectPaymentProvider } from "@parkwise/providers";
import { supabaseServer } from "../../../../lib/supabase/server";

/** MOCK UPI test payment. Disabled whenever real Razorpay keys are configured. Moves no money. */
export async function POST(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  if (!selectPaymentProvider(process.env).isMock) return NextResponse.json({ error: "not found" }, { status: 404 });
  const p = z.object({ orderId: z.string().min(5).max(100) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const paymentId = `mock_pay_${Date.now()}`;
  return NextResponse.json({ paymentId, signature: MockPaymentProvider.sign(p.data.orderId, paymentId) });
}
