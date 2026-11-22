import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { supabaseAdmin } from "../../../lib/supabase/admin";

const body = z.object({ who: z.enum(["mumbai", "ahmedabad", "driver"]) });

/** The demo accounts. Fake people and fake GSTINs (valid format, belong to no one). Their lots are real places with SIMULATED occupancy. */
const DEMO_PASSWORD = "ParkDemo#2026";
const WHO = {
  mumbai: { email: "mumbai.operator@parkwise.example", name: "Mumbai demo operator", operator: { org: "Phoenix Marketcity Parking (Demo operator)", city: "Mumbai", gstin: "27AAACP1234C1Z1", lot: "Phoenix Marketcity, Kurla" } },
  ahmedabad: { email: "ahmedabad.operator@parkwise.example", name: "Ahmedabad demo operator", operator: { org: "Alpha One Parking (Demo operator)", city: "Ahmedabad", gstin: "24AAACA5678D1ZW", lot: "Alpha One Mall, Vastrapur" } },
  driver: { email: "driver@parkwise.example", name: "Demo driver", operator: null },
} as const;

/**
 * Makes sure a demo account exists and can sign in with the demo password, then the browser signs in normally.
 * Only these three fixed accounts can be touched. Switch it off with DEMO_LOGINS=off (server) or NEXT_PUBLIC_DEMO_LOGINS=off.
 */
export async function POST(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  if (process.env.DEMO_LOGINS === "off" || process.env.NEXT_PUBLIC_DEMO_LOGINS === "off") return NextResponse.json({ error: "Demo logins are switched off." }, { status: 404 });
  const many = limited(req, "demo-login", 15);
  if (many) return many;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Demo logins need the server key, which is not configured." }, { status: 503 });
  const d = WHO[p.data.who];

  // 1) the user, with the demo password
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({ email: d.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name: d.name, account_type: d.operator ? "operator" : "driver" } });
  if (created.data?.user) userId = created.data.user.id;
  else {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list.data?.users.find((u) => u.email === d.email);
    if (!found) return NextResponse.json({ error: "Could not set up the demo account." }, { status: 500 });
    userId = found.id;
    const upd = await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
    if (upd.error) return NextResponse.json({ error: "Could not set up the demo account." }, { status: 500 });
  }

  // 2) operators: a verified demo business that owns one real-place lot (simulated occupancy)
  if (d.operator) {
    const o = d.operator;
    const full = { name: o.org, city: o.city, gstin: o.gstin, verified_at: new Date().toISOString(), is_synthetic: true };
    let { data: org } = await admin.from("organizations").select("id").eq("name", o.org).maybeSingle();
    if (!org) {
      let r = await admin.from("organizations").insert(full).select("id").single();
      // migration 0011 (GSTIN, verification) may not be applied yet: create the business without those columns
      if (r.error && (r.error.code === "42703" || r.error.code === "PGRST204")) r = await admin.from("organizations").insert({ name: o.org, city: o.city, is_synthetic: true }).select("id").single();
      if (r.error || !r.data) return NextResponse.json({ error: "Could not set up the demo business." }, { status: 500 });
      org = r.data;
    }
    await admin.from("profiles").update({ role: "operator_admin", org_id: org.id }).eq("id", userId);
    const { data: shared } = await admin.from("organizations").select("id").eq("name", "Demo data (simulated occupancy)").eq("city", o.city).maybeSingle();
    if (shared) await admin.from("lots").update({ org_id: org.id }).eq("name", o.lot).eq("city", o.city).eq("org_id", shared.id);
  }
  return NextResponse.json({ ok: true, email: d.email });
}
