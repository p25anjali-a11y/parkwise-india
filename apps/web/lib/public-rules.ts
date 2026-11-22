import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Each lot's active default price rules, for pricing a quote on the server.
 * Row level security hides price_rules from drivers (an operator's floor and ceiling are theirs), but a driver must
 * be quoted using the operator's own rates, so trusted server code reads them with the service role.
 * Only the lot ids the caller already found as visible (approved) are passed in; the rules are never sent to the browser.
 * Falls back to the caller's own client when no service key is configured (operators then still see their own).
 */
export async function loadRulesFor(sb: SupabaseClient, lotIds: string[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  if (lotIds.length === 0) return out;
  const client = supabaseAdmin() ?? sb;
  const { data } = await client.from("price_rules").select("lot_id,rules").in("lot_id", lotIds).eq("active", true).is("zone_id", null);
  for (const r of data ?? []) out.set(r.lot_id as string, r.rules);
  return out;
}
