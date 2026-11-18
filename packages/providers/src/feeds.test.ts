import { describe, expect, it } from "vitest";
import { feedHealth, FEED_ADAPTERS, parseSnapshotCsv, parseWebhookEvents, PartnershipStubFeed, signWebhook, verifyWebhook } from "./feeds";

const body = '{"events":[]}';
const now = 1_800_000_000;

describe("webhook signature", () => {
  const sig = signWebhook("s3cret", now, body);
  it("accepts a valid, fresh signature", () => {
    expect(verifyWebhook({ secret: "s3cret", timestamp: String(now), signature: sig, rawBody: body, nowSec: now + 10 })).toEqual({ ok: true });
  });
  it("rejects a tampered body, wrong secret and missing signature", () => {
    expect(verifyWebhook({ secret: "s3cret", timestamp: String(now), signature: sig, rawBody: body + " ", nowSec: now })).toMatchObject({ ok: false, reason: "bad_signature" });
    expect(verifyWebhook({ secret: "other", timestamp: String(now), signature: sig, rawBody: body, nowSec: now })).toMatchObject({ ok: false });
    expect(verifyWebhook({ secret: "s3cret", timestamp: String(now), signature: null, rawBody: body, nowSec: now })).toMatchObject({ ok: false });
  });
  it("rejects replays outside the window and bad timestamps", () => {
    expect(verifyWebhook({ secret: "s3cret", timestamp: String(now), signature: sig, rawBody: body, nowSec: now + 301 })).toMatchObject({ ok: false, reason: "stale" });
    expect(verifyWebhook({ secret: "s3cret", timestamp: "abc", signature: sig, rawBody: body, nowSec: now })).toMatchObject({ ok: false, reason: "bad_timestamp" });
    expect(verifyWebhook({ secret: "s3cret", timestamp: null, signature: sig, rawBody: body, nowSec: now })).toMatchObject({ ok: false, reason: "bad_timestamp" });
  });
  it("binds the timestamp into the signature", () => {
    expect(verifyWebhook({ secret: "s3cret", timestamp: String(now + 1), signature: sig, rawBody: body, nowSec: now + 1 })).toMatchObject({ ok: false, reason: "bad_signature" });
  });
});

describe("webhook events", () => {
  const ok = { occurred_at: "2026-11-20T10:00:00+05:30", direction: "entry", idempotency_key: "k1" };
  it("normalises timestamps and keeps optional fields", () => {
    const r = parseWebhookEvents({ events: [{ ...ok, vehicle_class: "ev", vehicle_hash: "abc" }] });
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ occurred_at: "2026-11-20T04:30:00.000Z", vehicle_class: "ev", vehicle_hash: "abc" });
  });
  it("reports each bad event and drops unknown fields such as plate numbers", () => {
    const r = parseWebhookEvents({ events: [ok, { ...ok, direction: "up" }, { ...ok, idempotency_key: "" }, { ...ok, vehicle_class: "bus" }, { ...ok, idempotency_key: "k2", plate: "MH01AB1234" }] });
    expect(r.rows).toHaveLength(2);
    expect(r.errors).toHaveLength(3);
    expect(JSON.stringify(r.rows)).not.toContain("MH01");
  });
  it("rejects non-array and oversized bodies", () => {
    expect(parseWebhookEvents({}).errors).toHaveLength(1);
    expect(parseWebhookEvents({ events: Array.from({ length: 1001 }, () => ok) }).errors[0]).toContain("at most");
  });
});

describe("snapshot csv", () => {
  it("parses rows and reports bad ones", () => {
    const r = parseSnapshotCsv("captured_at,occupied\n2026-11-20T10:00:00Z,120\n# c\nnope,5\n2026-11-20T10:15:00Z,-1\n2026-11-20T10:30:00Z,1.5\n");
    expect(r.rows).toEqual([{ captured_at: "2026-11-20T10:00:00.000Z", occupied: 120 }]);
    expect(r.errors).toHaveLength(3);
  });
});

describe("registry and health", () => {
  it("labels unbuilt adapters as requiring partnership and the stubs always throw", async () => {
    expect(FEED_ADAPTERS.filter((a) => a.status === "requires partnership").map((a) => a.id)).toEqual(["fastag", "vendor", "external_availability"]);
    await expect(new PartnershipStubFeed("fastag").poll()).rejects.toThrow("requires a partnership");
  });
  it("classifies feed freshness", () => {
    const n = new Date("2026-11-20T10:00:00Z");
    expect(feedHealth(null, n)).toBe("no_feed");
    expect(feedHealth(new Date("2026-11-20T09:50:00Z"), n)).toBe("live");
    expect(feedHealth(new Date("2026-11-20T09:30:00Z"), n)).toBe("stale");
  });
});
