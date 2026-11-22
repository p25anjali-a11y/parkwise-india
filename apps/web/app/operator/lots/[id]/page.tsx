import Link from "next/link";
import { notFound } from "next/navigation";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { supabaseServer } from "../../../../lib/supabase/server";
import { operatorScope } from "../../../../lib/operator-scope";
import { RulesForm } from "./RulesForm";
import { submitForApproval } from "./actions";

export const dynamic = "force-dynamic";

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const scope = await operatorScope(sb);
  if (!scope) notFound();
  let lq = sb.from("lots").select("id,name,city,address,category,status").eq("id", id);
  if (scope.orgId) lq = lq.eq("org_id", scope.orgId);
  const { data: lot } = await lq.maybeSingle();
  if (!lot) notFound();
  const { data: zones } = await sb.from("zones").select("id,name,capacity,reservable_pct,reserved_count").eq("lot_id", id);
  const { data: rr } = await sb.from("price_rules").select("rules").eq("lot_id", id).eq("active", true).is("zone_id", null).maybeSingle();
  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const zone = zones?.[0];
  const preview = [0.3, 0.6, 0.85, 0.95].map((o) =>
    quote({ lotId: id, zoneId: zone?.id ?? "preview", rules, predictedOccupancy: o, arrivalTime: new Date(), durationMin: 60 }),
  );
  return (
    <main className="shell">
      <div className="top"><p style={{ margin: 0 }}><Link href="/operator">← All lots</Link></p>
      <h1 style={{ marginTop: 8 }}>{lot.name}</h1>
      <p>{lot.city} · {lot.category} · <span className="pill grey">{lot.status}</span></p></div>
      {lot.status === "draft" && (
        <form action={submitForApproval.bind(null, id)}><button type="submit" className="btn block" style={{ marginBottom: 12 }}>Submit for approval</button></form>
      )}
      <div className="card"><h2>Zones</h2>
      {(zones ?? []).map((z) => <div className="rowb" key={z.id} style={{ marginBottom: 8 }}><strong>{z.name}</strong><span className="muted">{z.capacity} bays · {Math.round(Number(z.reservable_pct) * 100)}% reservable · {z.reserved_count} sold</span></div>)}</div>
      <div className="card"><h2>Pricing</h2>
      <RulesForm lotId={id} base={rules.baseRatePerHour / 100} floor={rules.floorMultiplier} ceiling={rules.ceilingMultiplier} dynamic={rules.dynamicEnabled} />
      </div>
      <div className="card"><h2>What-if preview (1 hour, at each occupancy level; not live data)</h2>
      <table className="tbl">
        <thead><tr><th>Occupancy</th><th className="r">Rate/hr</th><th>Label</th></tr></thead>
        <tbody>
          {preview.map((q) => (
            <tr key={q.predictedOccupancy}><td>{Math.round((q.predictedOccupancy ?? 0) * 100)}%</td><td className="r">₹{(q.ratePerHour / 100).toFixed(2)}</td><td>{q.label}</td></tr>
          ))}
        </tbody>
      </table></div>
    </main>
  );
}
