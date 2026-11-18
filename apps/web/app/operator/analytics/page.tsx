import Link from "next/link";
import { hourlyProfile, pricingSummary, reservationSummary } from "../../../lib/analytics";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const { lot: lotId } = await searchParams;
  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name").order("name");
  const lot = (lots ?? []).find((l) => l.id === lotId) ?? (lots ?? [])[0];
  if (!lot) return <main style={{ padding: 24 }}>No lots yet.</main>;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [snaps, res, quotes] = await Promise.all([
    sb.from("capacity_snapshots").select("captured_at,occupied,capacity").eq("lot_id", lot.id).gte("captured_at", since).order("captured_at").limit(3000),
    sb.from("reservations").select("status,total_paise,duration_min").eq("lot_id", lot.id).gte("created_at", since),
    sb.from("price_quotes").select("multiplier").eq("lot_id", lot.id).gte("created_at", since).limit(5000),
  ]);
  const profile = hourlyProfile(snaps.data ?? []);
  const rs = reservationSummary(res.data ?? []);
  const ps = pricingSummary((quotes.data ?? []).map((q) => ({ multiplier: Number(q.multiplier) })));
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <p><Link href="/operator">← Your lots</Link></p>
      <h1>Analytics: {lot.name}</h1>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(lots ?? []).map((l) => <Link key={l.id} href={`/operator/analytics?lot=${l.id}`} style={{ fontWeight: l.id === lot.id ? 700 : 400 }}>{l.name}</Link>)}</nav>
      <h2>Average occupancy by hour (last 30 days, IST)</h2>
      <svg role="img" aria-label="Average occupancy by hour of day" viewBox="0 0 480 140" style={{ width: "100%", maxWidth: 560 }}>
        {profile.map((v, h) => (
          <g key={h}>
            <rect x={h * 20 + 2} y={120 - (v ?? 0) * 110} width={16} height={(v ?? 0) * 110} fill={v == null ? "#ddd" : v >= 0.9 ? "#c0392b" : v >= 0.7 ? "#e67e22" : "#27ae60"} />
            {h % 3 === 0 && <text x={h * 20 + 10} y={134} fontSize={9} textAnchor="middle">{h}</text>}
          </g>
        ))}
      </svg>
      <h2>Reservations (last 30 days)</h2>
      <p>{rs.reservations} total · {rs.confirmed} confirmed · {rs.cancelledOrExpired} cancelled or expired · conversion {rs.conversionPct ?? "n/a"}{rs.conversionPct != null ? "%" : ""}</p>
      <p>Gross paid: ₹{(rs.grossPaise / 100).toFixed(0)} <span style={{ fontSize: 13, color: "#555" }}>(before refunds and platform fees; test payments included)</span></p>
      <h2>Pricing (last 30 days)</h2>
      <p>{ps.count} quotes · mean multiplier {ps.meanMultiplier ?? "n/a"} · {ps.peakSharePct ?? "n/a"}{ps.peakSharePct != null ? "%" : ""} priced above standard</p>
    </main>
  );
}
