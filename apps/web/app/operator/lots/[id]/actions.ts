"use server";
import { revalidatePath } from "next/cache";
import { DEFAULT_RULES, validateRules, type PricingRules } from "@parkwise/pricing";
import { supabaseServer } from "../../../../lib/supabase/server";
import { rulesInput, rupeesToPaise } from "../../../../lib/lot-schema";

export async function saveRules(lotId: string, _prev: { error?: string; ok?: boolean }, form: FormData) {
  const p = rulesInput.safeParse({ ...Object.fromEntries(form), dynamicEnabled: form.get("dynamicEnabled") === "on" });
  if (!p.success) return { error: p.error.issues.map((i) => i.message).join("; ") };
  const sb = await supabaseServer();
  const { data: existing } = await sb.from("price_rules").select("id,rules,version").eq("lot_id", lotId).eq("active", true).is("zone_id", null).maybeSingle();
  const next: PricingRules = {
    ...DEFAULT_RULES,
    ...((existing?.rules as Partial<PricingRules>) ?? {}),
    baseRatePerHour: rupeesToPaise(p.data.baseRupeesPerHour),
    floorMultiplier: p.data.floorMultiplier,
    ceilingMultiplier: p.data.ceilingMultiplier,
    dynamicEnabled: p.data.dynamicEnabled,
  };
  try {
    validateRules(next);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const res = existing
    ? await sb.from("price_rules").update({ rules: next, version: existing.version + 1 }).eq("id", existing.id)
    : await sb.from("price_rules").insert({ lot_id: lotId, name: "Default dynamic tariff", rules: next });
  if (res.error) return { error: res.error.message };
  revalidatePath(`/operator/lots/${lotId}`);
  return { ok: true };
}

export async function submitForApproval(lotId: string) {
  const sb = await supabaseServer();
  // Only a verified business may submit a lot (migration 0011). If the column is not there yet, this check is skipped.
  const { data: lot } = await sb.from("lots").select("org_id").eq("id", lotId).maybeSingle();
  const { data: org, error: oe } = lot ? await sb.from("organizations").select("verified_at").eq("id", lot.org_id).maybeSingle() : { data: null, error: null };
  if (!oe && org && !org.verified_at) return;
  await sb.from("lots").update({ status: "pending_approval" }).eq("id", lotId).eq("status", "draft");
  revalidatePath(`/operator/lots/${lotId}`);
}
