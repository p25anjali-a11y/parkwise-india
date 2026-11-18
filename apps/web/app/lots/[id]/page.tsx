import Link from "next/link";
import { notFound } from "next/navigation";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { EtaButton } from "../../../components/EtaButton";
import { availabilityNow } from "../../../lib/geo";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LotDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,name,city,address,category,is_synthetic").eq("id", id).eq("status", "approved").maybeSingle();
  if (!lot) notFound();
  const { data: live } = await sb.from("lot_live_state").select("occupied,capacity,updated_at").eq("lot_id", id).maybeSingle();
  const { data: rr } = await sb.from("price_rules").select("rules").eq("lot_id", id).eq("active", true).is("zone_id", null).maybeSingle();
  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const occ = live ? live.occupied / live.capacity : 0;
  const q = quote({ lotId: id, zoneId: "now", rules, predictedOccupancy: occ, arrivalTime: new Date(), durationMin: 60 });
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <p><Link href="/search">← Search</Link></p>
      <h1>{lot.name}</h1>
      <p>{lot.address ?? lot.city} · {lot.category}{lot.is_synthetic ? " · synthetic demo lot" : ""}</p>
      <p>{live ? `${availabilityNow(live.occupied, live.capacity)} (${live.occupied}/${live.capacity} cars now)` : "No live count yet"}</p>
      <EtaButton lotId={id} />
      <h2>Why this price</h2>
      <p>₹{(q.ratePerHour / 100).toFixed(0)}/hr now ({q.label}).</p>
      <ol>{q.breakdown.map((s, i) => <li key={i}>{s.label}: {s.multiplier.toFixed(2)}x</li>)}</ol>
    </main>
  );
}
