import type { SupabaseClient } from "@supabase/supabase-js";

export interface OperatorScope {
  userId: string;
  role: string;
  /** Null for a platform admin (sees every organisation). */
  orgId: string | null;
  isPlatformAdmin: boolean;
  /** True when the organisation is a demo business: its lots show simulated traffic even if a lot itself is not flagged. */
  demoOrg?: boolean;
}

/**
 * Who is asking, and which organisation do they operate for?
 * Row level security lets everyone read approved lots (drivers need that), so operator screens
 * must filter by organisation themselves. Returns null if not signed in or not an operator.
 */
export async function operatorScope(sb: SupabaseClient): Promise<OperatorScope | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("profiles").select("role,org_id").eq("id", user.id).maybeSingle();
  const role = me?.role as string | undefined;
  if (role === "platform_admin") return { userId: user.id, role, orgId: null, isPlatformAdmin: true };
  if ((role === "operator" || role === "operator_admin") && me?.org_id) {
    const { data: org } = await sb.from("organizations").select("is_synthetic").eq("id", me.org_id).maybeSingle();
    return { userId: user.id, role, orgId: me.org_id as string, isPlatformAdmin: false, demoOrg: org?.is_synthetic === true };
  }
  return null;
}

/** The lots this operator may see: their own organisation's (all of them for a platform admin). */
export async function scopedLots<T extends string>(sb: SupabaseClient, scope: OperatorScope, columns: T) {
  let q = sb.from("lots").select(columns).order("name");
  if (scope.orgId) q = q.eq("org_id", scope.orgId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return scope.demoOrg ? rows.map((r): Record<string, any> => ({ ...r, is_synthetic: true })) : rows; // eslint-disable-line @typescript-eslint/no-explicit-any
}
