"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "../../../../lib/supabase/server";
import { lotInput, rupeesToPaise } from "../../../../lib/lot-schema";
import { DEFAULT_RULES } from "@parkwise/pricing";

export async function createLot(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const parsed = lotInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const v = parsed.data;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) return { error: "Your account is not linked to an operator organisation yet." };

  const { data: lot, error } = await sb
    .from("lots")
    .insert({ org_id: profile.org_id, name: v.name, city: v.city, address: v.address || null, category: v.category, lat: v.lat, lng: v.lng, status: "draft" })
    .select("id")
    .single();
  if (error || !lot) return { error: error?.message ?? "Could not create lot" };

  const { data: car } = await sb.from("slot_types").select("id").eq("code", "car").single();
  const z = await sb.from("zones").insert({ lot_id: lot.id, slot_type_id: car?.id, name: "Cars", capacity: v.carCapacity, reservable_pct: v.reservablePct / 100 });
  if (z.error) return { error: z.error.message };
  if (v.evBays > 0) {
    const { data: ev } = await sb.from("slot_types").select("id").eq("code", "ev").single();
    const ze = await sb.from("zones").insert({ lot_id: lot.id, slot_type_id: ev?.id, name: "EV bays", capacity: v.evBays, reservable_pct: 0 });
    if (ze.error) return { error: ze.error.message };
  }
  const r = await sb.from("price_rules").insert({ lot_id: lot.id, name: "Default dynamic tariff", rules: { ...DEFAULT_RULES, baseRatePerHour: rupeesToPaise(v.baseRupeesPerHour) } });
  if (r.error) return { error: r.error.message };
  redirect(`/operator/lots/${lot.id}`);
}
