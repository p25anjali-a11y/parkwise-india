import { createHmac, timingSafeEqual } from "node:crypto";
import type { ParseResult } from "./calendar";

export type Direction = "entry" | "exit";
export type VehicleClass = "car" | "two_wheeler" | "ev" | "accessible";

export interface FeedEvent {
  occurred_at: string;
  direction: Direction;
  vehicle_class?: VehicleClass;
  idempotency_key: string;
  vehicle_hash?: string;
  zone_id?: string;
}

export interface SnapshotRow {
  captured_at: string;
  occupied: number;
}

const CLASSES = new Set(["car", "two_wheeler", "ev", "accessible"]);
const MAX_EVENTS = 1000;

// ---------- HMAC webhook ----------

/** Signature = hex HMAC-SHA256 over `${timestamp}.${rawBody}`. The timestamp (unix seconds) is sent in a header and bounds replay. */
export function signWebhook(secret: string, timestamp: number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export type WebhookCheck = { ok: true } | { ok: false; reason: "bad_timestamp" | "stale" | "bad_signature" };

export function verifyWebhook(opts: { secret: string; timestamp: string | null; signature: string | null; rawBody: string; nowSec?: number; toleranceSec?: number }): WebhookCheck {
  const ts = Number(opts.timestamp);
  if (!opts.timestamp || !Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > (opts.toleranceSec ?? 300)) return { ok: false, reason: "stale" };
  const expected = Buffer.from(signWebhook(opts.secret, ts, opts.rawBody));
  const got = Buffer.from(opts.signature ?? "");
  return expected.length === got.length && timingSafeEqual(expected, got) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Body: {"events":[{occurred_at,direction,idempotency_key,vehicle_class?,vehicle_hash?,zone_id?}]}. At most 1000 events. */
export function parseWebhookEvents(body: unknown): ParseResult<FeedEvent> {
  const errors: string[] = [];
  const rows: FeedEvent[] = [];
  const list = (body as { events?: unknown })?.events;
  if (!Array.isArray(list)) return { rows, errors: ["body must be {\"events\": [...]}"] };
  if (list.length > MAX_EVENTS) return { rows, errors: [`at most ${MAX_EVENTS} events per request`] };
  list.forEach((raw, i) => {
    const e = raw as Record<string, unknown>;
    const t = typeof e?.occurred_at === "string" ? Date.parse(e.occurred_at) : NaN;
    if (Number.isNaN(t)) return void errors.push(`event ${i}: bad occurred_at`);
    if (e.direction !== "entry" && e.direction !== "exit") return void errors.push(`event ${i}: direction must be entry or exit`);
    if (typeof e.idempotency_key !== "string" || e.idempotency_key.length < 1 || e.idempotency_key.length > 128) return void errors.push(`event ${i}: idempotency_key required (1-128 chars)`);
    if (e.vehicle_class !== undefined && !CLASSES.has(String(e.vehicle_class))) return void errors.push(`event ${i}: unknown vehicle_class`);
    // Never accept plate numbers: only an opaque hash, if the operator chooses to send one.
    rows.push({
      occurred_at: new Date(t).toISOString(),
      direction: e.direction,
      idempotency_key: e.idempotency_key,
      ...(e.vehicle_class ? { vehicle_class: e.vehicle_class as VehicleClass } : {}),
      ...(typeof e.vehicle_hash === "string" ? { vehicle_hash: e.vehicle_hash.slice(0, 128) } : {}),
      ...(typeof e.zone_id === "string" ? { zone_id: e.zone_id } : {}),
    });
  });
  return { rows, errors };
}

// ---------- CSV snapshots ----------

/** CSV columns: captured_at,occupied (ISO 8601 timestamp, integer). Header optional, # comments ignored. */
export function parseSnapshotCsv(text: string): ParseResult<SnapshotRow> {
  const rows: SnapshotRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length > MAX_EVENTS + 1) return { rows, errors: [`at most ${MAX_EVENTS} rows`] };
  lines.forEach((l, i) => {
    const [ts, occ] = l.split(",").map((c) => c.trim());
    if (i === 0 && ts === "captured_at") return;
    const t = Date.parse(ts ?? "");
    const n = Number(occ);
    if (Number.isNaN(t) || !Number.isInteger(n) || n < 0) return void errors.push(`line ${i + 1}: need ISO timestamp and a non-negative integer`);
    rows.push({ captured_at: new Date(t).toISOString(), occupied: n });
  });
  return { rows, errors };
}

// ---------- adapter registry and honest stubs ----------

export type AdapterStatus = "built" | "requires partnership";

export interface FeedAdapterInfo {
  id: "webhook" | "csv" | "fastag" | "vendor" | "external_availability";
  name: string;
  status: AdapterStatus;
  note: string;
}

export const FEED_ADAPTERS: FeedAdapterInfo[] = [
  { id: "webhook", name: "Signed webhook (entry and exit events)", status: "built", note: "HMAC-SHA256 over timestamp.body, 5-minute replay window, idempotent per event key." },
  { id: "csv", name: "CSV snapshot upload", status: "built", note: "Absolute occupancy counts with timestamps. Good for pilots and gap-filling." },
  { id: "fastag", name: "FASTag toll-style entry and exit", status: "requires partnership", note: "Stub only. Needs an agreement with an acquiring bank or the payments network; no integration exists." },
  { id: "vendor", name: "Barrier / ANPR vendor systems", status: "requires partnership", note: "Stub only. Each vendor needs its own partnership and API contract." },
  { id: "external_availability", name: "External availability API", status: "requires partnership", note: "Stub only. Enable only after confirming the provider covers India and the licence allows our use." },
];

export class NotAvailableError extends Error {
  constructor(readonly adapter: string) {
    super(`${adapter} requires a partnership and is not integrated`);
  }
}

/** Placeholder for adapters that cannot be built without a commercial partnership. Always throws. */
export class PartnershipStubFeed {
  constructor(readonly adapter: FeedAdapterInfo["id"]) {}
  async poll(): Promise<never> {
    throw new NotAvailableError(this.adapter);
  }
}

/** Staleness thresholds used by the integrations page and forecast widening. */
export function feedHealth(lastFeedAt: Date | null, now: Date = new Date()): "live" | "stale" | "no_feed" {
  if (!lastFeedAt) return "no_feed";
  return now.getTime() - lastFeedAt.getTime() <= 15 * 60_000 ? "live" : "stale";
}
