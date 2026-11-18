import Link from "next/link";
import { notFound } from "next/navigation";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { QuoteForm } from "../../../components/QuoteForm";
import { EtaButton } from "../../../components/EtaButton";
import { availabilityNow } from "../../../lib/geo";
import { chooseOccupancy } from "../../../lib/occupancy-input";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LotDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,name,city,address,category").eq("id", id).eq("status", "approved").maybeSingle();
  if (!lot) notFound();
  const { data: live } = await sb.from("lot_live_state").select("occupied,capacity,updated_at,source,is_synthetic").eq("lot_id", id).maybeSingle();
  const { data: rr } = await sb.from("price_rules").select("rules").eq("lot_id", id).eq("active", true).is("zone_id", null).maybeSingle();
  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const now = new Date();
  const occ = chooseOccupancy({ forecast: null, live: live ?? null, arrival: now, now });
  const q = quote({ lotId: id, zoneId: "now", rules, predictedOccupancy: occ.value, arrivalTime: now, durationMin: 60, inputs: [occ.input] });
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <p><Link href="/search">← Search</Link></p>
      <h1>{lot.name}</h1>
      <p>{lot.address ?? lot.city} · {lot.category}</p>
      <p>{occ.value !== null && live ? `${availabilityNow(live.occupied, live.capacity)} (${live.occupied}/${live.capacity} cars, updated ${new Date(live.updated_at).toLocaleTimeString("en-IN")})` : "No live availability: this lot has no fresh occupancy count"}</p>
      <EtaButton lotId={id} />
      <QuoteForm lotId={id} />
      <h2>Why this price (right now)</h2>
      <p>₹{(q.ratePerHour / 100).toFixed(0)}/hr now ({q.label}).</p>
      <ol>{q.breakdown.map((s, i) => <li key={i}>{s.label}: {s.multiplier.toFixed(2)}x</li>)}</ol>
    </main>
  );
}
