import Link from "next/link";
import { notFound } from "next/navigation";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { supabaseServer } from "../../../../lib/supabase/server";
import { RulesForm } from "./RulesForm";
import { submitForApproval } from "./actions";

export const dynamic = "force-dynamic";

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,name,city,address,category,status").eq("id", id).maybeSingle();
  if (!lot) notFound();
  const { data: zones } = await sb.from("zones").select("id,name,capacity,reservable_pct,reserved_count").eq("lot_id", id);
  const { data: rr } = await sb.from("price_rules").select("rules").eq("lot_id", id).eq("active", true).is("zone_id", null).maybeSingle();
  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const zone = zones?.[0];
  const preview = [0.3, 0.6, 0.85, 0.95].map((o) =>
    quote({ lotId: id, zoneId: zone?.id ?? "preview", rules, predictedOccupancy: o, arrivalTime: new Date(), durationMin: 60 }),
  );
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p><Link href="/operator">← All lots</Link></p>
      <h1>{lot.name}</h1>
      <p>{lot.city} · {lot.category} · <em>{lot.status}</em></p>
      {lot.status === "draft" && (
        <form action={submitForApproval.bind(null, id)}><button type="submit">Submit for approval</button></form>
      )}
      <h2>Zones</h2>
      <ul>{(zones ?? []).map((z) => <li key={z.id}>{z.name}: {z.capacity} bays, {Math.round(Number(z.reservable_pct) * 100)}% reservable ({z.reserved_count} sold)</li>)}</ul>
      <h2>Pricing</h2>
      <RulesForm lotId={id} base={rules.baseRatePerHour / 100} floor={rules.floorMultiplier} ceiling={rules.ceilingMultiplier} dynamic={rules.dynamicEnabled} />
      <h3>What-if preview of your rules (1 hour, at each occupancy level; not live data)</h3>
      <table>
        <thead><tr><th>Occupancy</th><th>Rate/hr</th><th>Label</th></tr></thead>
        <tbody>
          {preview.map((q) => (
            <tr key={q.predictedOccupancy}><td>{Math.round((q.predictedOccupancy ?? 0) * 100)}%</td><td>₹{(q.ratePerHour / 100).toFixed(2)}</td><td>{q.label}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
