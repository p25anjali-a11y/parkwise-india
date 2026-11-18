/**
 * Best-effort fixed-window limiter held in memory. On serverless each instance has its own counters, so this only
 * blunts bursts and accidental loops; real abuse protection needs an edge or shared-store limiter (listed in the backlog).
 */
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.n++;
  return b.n <= limit ? { ok: true, retryAfterSec: 0 } : { ok: false, retryAfterSec: Math.ceil((b.reset - now) / 1000) };
}

export function clientKey(req: Request, scope: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

export function limited(req: Request, scope: string, limit: number, windowMs = 60_000): Response | null {
  const r = rateLimit(clientKey(req, scope), limit, windowMs);
  return r.ok ? null : new Response(JSON.stringify({ error: "too many requests" }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(r.retryAfterSec) } });
}
