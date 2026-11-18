import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { z } from "zod";
import { planScenario, type DemoLot } from "../../../lib/demo-scenario";
import { runForecasts } from "../../../lib/forecast-run";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { supabaseServer } from "../../../lib/supabase/server";

export const maxDuration = 60;

const body = z.object({ scenario: z.enum(["busy_saturday", "ipl_night", "reset"]) });

/** Platform-admin demo control. Writes only to synthetic lots and rows tagged source "demo-sim"; reset removes them. */
export async function POST(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "platform_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });

  await admin.from("events").delete().eq("source", "demo-sim");
  await admin.from("demand_signals").delete().eq("source", "demo-sim");

  const { data: lots } = await admin.from("lots").select("id,city,category,is_synthetic,lot_live_state(capacity)").eq("is_synthetic", true);
  const demoLots: DemoLot[] = (lots ?? []).map((l) => ({ id: l.id, city: l.city, category: l.category, isSynthetic: l.is_synthetic, capacity: (l.lot_live_state as unknown as { capacity: number } | null)?.capacity ?? 0 })).filter((l) => l.capacity > 0);

  if (p.data.scenario === "reset") {
    for (const l of demoLots) {
      const { data: last } = await admin.from("capacity_snapshots").select("occupied").eq("lot_id", l.id).order("captured_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await admin.from("lot_live_state").update({ occupied: last.occupied, updated_at: new Date().toISOString() }).eq("lot_id", l.id);
    }
  } else {
    const plan = planScenario(demoLots, p.data.scenario);
    for (const u of plan.live) await admin.from("lot_live_state").update({ occupied: u.occupied, updated_at: new Date().toISOString() }).eq("lot_id", u.lot_id);
    if (plan.events.length) await admin.from("events").insert(plan.events as never);
    if (plan.signals.length) await admin.from("demand_signals").insert(plan.signals as never);
  }
  const forecast = await runForecasts(admin);
  return NextResponse.json({ scenario: p.data.scenario, lots: demoLots.length, forecast });
}
