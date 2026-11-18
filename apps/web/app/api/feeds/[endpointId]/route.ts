import { NextResponse } from "next/server";
import { parseWebhookEvents, verifyWebhook } from "@parkwise/providers";
import { decryptSecret } from "../../../../lib/secret-box";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

/** Signed webhook: POST {"events":[...]} with X-Parkwise-Timestamp and X-Parkwise-Signature. Idempotent per event key. */
export async function POST(req: Request, ctx: { params: Promise<{ endpointId: string }> }) {
  const { endpointId } = await ctx.params;
  const admin = supabaseAdmin();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(endpointId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 500_000) return NextResponse.json({ error: "too large" }, { status: 413 });

  const { data: ep } = await admin.from("feed_endpoints").select("lot_id,secret_ciphertext,active").eq("id", endpointId).maybeSingle();
  // Same response for unknown and inactive endpoints so ids cannot be probed.
  if (!ep || !ep.active) return NextResponse.json({ error: "not found" }, { status: 404 });
  let secret: string;
  try {
    secret = decryptSecret(ep.secret_ciphertext);
  } catch {
    return NextResponse.json({ error: "endpoint misconfigured" }, { status: 500 });
  }
  const check = verifyWebhook({ secret, timestamp: req.headers.get("x-parkwise-timestamp"), signature: req.headers.get("x-parkwise-signature"), rawBody: raw });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = parseWebhookEvents(json);
  if (parsed.errors.length && parsed.rows.length === 0) return NextResponse.json({ errors: parsed.errors }, { status: 422 });
  const { data, error } = await admin.rpc("ingest_occupancy_events", { p_lot: ep.lot_id, p_source: "webhook", p_events: parsed.rows as never });
  if (error) return NextResponse.json({ error: "could not ingest" }, { status: 500 });
  return NextResponse.json({ ...(data as object), rejected: parsed.errors });
}
