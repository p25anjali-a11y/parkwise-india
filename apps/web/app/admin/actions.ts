"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../../lib/supabase/admin";
import { supabaseServer } from "../../lib/supabase/server";

async function requireAdmin() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return me?.role === "platform_admin" ? { sb, user } : null;
}

/** Marks an operator business as verified after the admin has checked its GSTIN on the GST portal. Writes an audit row. */
export async function verifyOrganization(orgId: string, _form: FormData) {
  const ctx = await requireAdmin();
  if (!ctx) return;
  const { error } = await ctx.sb.from("organizations").update({ verified_at: new Date().toISOString(), verified_by: ctx.user.id }).eq("id", orgId).is("verified_at", null);
  if (error) return;
  await supabaseAdmin()?.from("audit_log").insert({ actor_id: ctx.user.id, org_id: orgId, action: "org.verify", entity: "organization", entity_id: orgId, before: { verified: false }, after: { verified: true }, reason: "GSTIN checked by platform admin" });
  revalidatePath("/admin");
}

const NEXT: Record<string, "approved" | "suspended" | "draft"> = { approve: "approved", suspend: "suspended", reopen: "draft" };

/** Changes a lot's status as platform admin (RLS and the guard trigger allow only admins) and writes an immutable audit row. */
export async function setLotStatus(lotId: string, action: string, form: FormData) {
  const ctx = await requireAdmin();
  const to = NEXT[action];
  if (!ctx || !to) return;
  const reason = String(form.get("reason") ?? "").slice(0, 300) || null;
  const { data: before } = await ctx.sb.from("lots").select("status,org_id").eq("id", lotId).maybeSingle();
  if (!before || before.status === to) return;
  const { error } = await ctx.sb.from("lots").update({ status: to }).eq("id", lotId);
  if (error) return;
  const admin = supabaseAdmin();
  await admin?.from("audit_log").insert({ actor_id: ctx.user.id, org_id: before.org_id, action: `lot.${action}`, entity: "lot", entity_id: lotId, before: { status: before.status }, after: { status: to }, reason });
  revalidatePath("/admin");
}
