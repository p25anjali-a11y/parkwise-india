import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MockPaymentProvider, RazorpayProvider, selectPaymentProvider } from "./payments";

describe("razorpay adapter", () => {
  it("creates an order with basic auth and integer paise", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ id: "order_X1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const o = await new RazorpayProvider("rzp_test_abc", "sec", "wh", fake).createOrder(12345, "res-1");
    expect(o).toMatchObject({ orderId: "order_X1", amountPaise: 12345, isTest: true, keyId: "rzp_test_abc" });
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ amount: 12345, currency: "INR" });
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_abc:sec").toString("base64")}`);
  });
  it("flags live keys as not test", () => {
    expect(new RazorpayProvider("rzp_live_x", "s").isTest).toBe(false);
  });
  it("verifies the checkout signature (order_id|payment_id, HMAC-SHA256)", () => {
    const p = new RazorpayProvider("rzp_test_abc", "sec");
    const sig = createHmac("sha256", "sec").update("order_1|pay_1").digest("hex");
    expect(p.verifyCheckout("order_1", "pay_1", sig)).toBe(true);
    expect(p.verifyCheckout("order_1", "pay_2", sig)).toBe(false);
    expect(p.verifyCheckout("order_1", "pay_1", "short")).toBe(false);
  });
  it("verifies webhooks only when a secret is set", () => {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(new RazorpayProvider("k", "s", "whsec").verifyWebhook(body, sig)).toBe(true);
    expect(new RazorpayProvider("k", "s", "whsec").verifyWebhook(body + " ", sig)).toBe(false);
    expect(new RazorpayProvider("k", "s").verifyWebhook(body, sig)).toBe(false);
  });
  it("rejects failed order creation", async () => {
    const bad = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(new RazorpayProvider("k", "s", undefined, bad).createOrder(100, "r")).rejects.toThrow("401");
  });
});

describe("mock payments and selection", () => {
  it("mock is labelled and verifies its own signature only", async () => {
    const m = new MockPaymentProvider();
    const o = await m.createOrder(5000, "abc");
    expect(m.isMock).toBe(true);
    expect(o.isTest).toBe(true);
    expect(m.verifyCheckout(o.orderId, "pay_m", MockPaymentProvider.sign(o.orderId, "pay_m"))).toBe(true);
    expect(m.verifyCheckout(o.orderId, "pay_m", "bad")).toBe(false);
  });
  it("selects razorpay only when both keys exist", () => {
    expect(selectPaymentProvider({}).name).toBe("mock");
    expect(selectPaymentProvider({ RAZORPAY_KEY_ID: "k" }).name).toBe("mock");
    expect(selectPaymentProvider({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" }).name).toBe("razorpay");
  });
});
