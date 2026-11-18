import { createHmac, timingSafeEqual } from "node:crypto";

export interface PaymentOrder {
  orderId: string;
  amountPaise: number;
  currency: "INR";
  provider: string;
  isTest: boolean;
  /** Public key id for the checkout widget. Absent for the mock. */
  keyId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isMock: boolean;
  createOrder(amountPaise: number, receipt: string): Promise<PaymentOrder>;
  /** Verifies the signature the checkout returns after a payment. */
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean;
  /** Verifies a webhook body against its signature header. */
  verifyWebhook(rawBody: string, signature: string): boolean;
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

type Fetch = typeof fetch;

/** Razorpay Orders API in test mode (keys starting rzp_test_). Not exercised with live keys yet. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly isMock = false;
  constructor(private readonly keyId: string, private readonly keySecret: string, private readonly webhookSecret?: string, private readonly doFetch: Fetch = fetch) {}

  get isTest() {
    return this.keyId.startsWith("rzp_test_");
  }

  async createOrder(amountPaise: number, receipt: string): Promise<PaymentOrder> {
    const res = await this.doFetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}` },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40) }),
    });
    if (!res.ok) throw new Error(`Razorpay orders ${res.status}`);
    const j = (await res.json()) as { id?: string };
    if (!j.id) throw new Error("Razorpay returned no order id");
    return { orderId: j.id, amountPaise, currency: "INR", provider: "razorpay", isTest: this.isTest, keyId: this.keyId };
  }

  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean {
    const expected = createHmac("sha256", this.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEqualHex(expected, signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqualHex(createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex"), signature);
  }
}

/**
 * MOCK UPI test payment. Moves no money. Signatures are HMACs with a fixed demo secret so the verify path is exercised,
 * but this is NOT secure and must never be enabled in production traffic with real users.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly isMock = true;
  static readonly SECRET = "mock-upi-demo-secret";
  async createOrder(amountPaise: number, receipt: string): Promise<PaymentOrder> {
    return { orderId: `mock_order_${receipt.slice(0, 12)}_${Date.now()}`, amountPaise, currency: "INR", provider: "mock", isTest: true };
  }
  static sign(orderId: string, paymentId: string): string {
    return createHmac("sha256", MockPaymentProvider.SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  }
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean {
    return safeEqualHex(MockPaymentProvider.sign(orderId, paymentId), signature);
  }
  verifyWebhook(): boolean {
    return false;
  }
}

export function selectPaymentProvider(env: Record<string, string | undefined>, doFetch?: Fetch): PaymentProvider {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return new RazorpayProvider(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET, doFetch);
  }
  return new MockPaymentProvider();
}
