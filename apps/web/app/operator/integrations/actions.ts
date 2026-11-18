"use server";
import { revalidatePath } from "next/cache";
import { parseSnapshotCsv } from "@parkwise/providers";
import { encryptSecret, newFeedSecret } from "../../../lib/secret-box";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";

export interface ActionState { error?: string; ok?: string; secret?: string; endpointId?: string }

/** Confirms the caller is an operator admin of the lot's organisation, using RLS (lots are only visible to their org). */
async function authorise(lotId: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "operator_admin" && me?.role !== "platform_admin") return null;
  const { data: lot } = await sb.from("lots").select("id").eq("id", lotId).maybeSingle();
  return lot ? user : null;
}

/** Creates or rotates the webhook secret. The secret is shown once and stored only encrypted. */
export async function createEndpoint(lotId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  if (!(await authorise(lotId))) return { error: "Only an operator admin of this lot can do that." };
  const admin = supabaseAdmin();
  if (!admin) return { error: "Feeds are not enabled on this deployment yet (service key missing)." };
  let boxed: string;
  const { secret, prefix } = newFeedSecret();
  try {
    boxed = encryptSecret(secret);
  } catch {
    return { error: "FEED_ENCRYPTION_KEY is not configured on this deployment." };
  }
  const { data: existing } = await admin.from("feed_endpoints").select("id").eq("lot_id", lotId).eq("active", true).maybeSingle();
  const res = existing
    ? await admin.from("feed_endpoints").update({ secret_ciphertext: boxed, secret_prefix: prefix, rotated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single()
    : await admin.from("feed_endpoints").insert({ lot_id: lotId, secret_ciphertext: boxed, secret_prefix: prefix }).select("id").single();
  if (res.error) return { error: "Could not save the endpoint." };
  revalidatePath("/operator/integrations");
  return { ok: existing ? "Secret rotated. The old one stopped working." : "Endpoint created.", secret, endpointId: res.data.id };
}

export async function uploadCsv(lotId: string, _p: ActionState, form: FormData): Promise<ActionState> {
  if (!(await authorise(lotId))) return { error: "Only an operator admin of this lot can do that." };
  const admin = supabaseAdmin();
  if (!admin) return { error: "Feeds are not enabled on this deployment yet (service key missing)." };
  const parsed = parseSnapshotCsv(String(form.get("csv") ?? ""));
  if (parsed.errors.length) return { error: parsed.errors.slice(0, 5).join("; ") };
  if (parsed.rows.length === 0) return { error: "No rows found." };
  // Oldest first so the newest row ends up as the live count.
  for (const r of parsed.rows.sort((a, b) => a.captured_at.localeCompare(b.captured_at))) {
    const { error } = await admin.rpc("ingest_occupancy_snapshot", { p_lot: lotId, p_source: "csv", p_occupied: r.occupied, p_captured_at: r.captured_at });
    if (error) return { error: "Could not store a row; stopped." };
  }
  revalidatePath("/operator/integrations");
  return { ok: `Imported ${parsed.rows.length} rows.` };
}
