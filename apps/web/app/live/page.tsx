import Link from "next/link";
import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";
import { getLang } from "../../lib/lang";
import { resolveOccupancy } from "../../lib/resolve-occupancy";
import { liveWeatherRows, rainProbAt } from "../../lib/live-signals";
import { LiveLotSim } from "../../components/LiveLotSim";

export const dynamic = "force-dynamic";

export default async function Live({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const { t } = await getLang();
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const { lot: pick } = await searchParams;
  const sb = await supabaseServer();
  const { data: lots } = await sb.from("lots").select("id,name,city,category,is_synthetic").eq("status", "approved").order("city").order("name");
  const chosen = (lots ?? []).find((l) => l.id === pick) ?? (lots ?? [])[0];
  let sim: React.ReactNode = null;
  if (chosen) {
    const { data: live } = await sb.from("lot_live_state").select("occupied,capacity,updated_at,source,is_synthetic").eq("lot_id", chosen.id).maybeSingle();
    const { data: zones } = await sb.from("zones").select("capacity").eq("lot_id", chosen.id);
    const capacity = live?.capacity ?? (zones ?? []).reduce((n, z) => n + z.capacity, 0);
    const now = new Date();
    const wx = await liveWeatherRows(chosen.city, now);
    const occ = resolveOccupancy({ lot: chosen, forecast: null, live: live ?? null, arrival: now, now, rainProb: rainProbAt(wx, now) });
    if (occ.value !== null && capacity > 0) sim = <LiveLotSim key={chosen.id} lotId={chosen.id} capacity={capacity} initial={occ.value} simulated={occ.simulated} />;
  }
  return (
    <main className="shell">
      <div className="top"><h1>🚗 {t("liveTitle")}</h1><p>{t("liveSub")}</p></div>
      <div className="card lift">
        <div className="muted" style={{ marginBottom: 8 }}>{t("chooseLot")}</div>
        <div className="chips">
          {(lots ?? []).map((l) => <Link key={l.id} href={`/live?lot=${l.id}`} className={l.id === chosen?.id ? "chip on" : "chip"}>{l.name}</Link>)}
        </div>
      </div>
      {sim}
      {chosen && <Link href={`/lots/${chosen.id}`} className="btn blue block" style={{ marginTop: 12 }}>{chosen.name} →</Link>}
    </main>
  );
}
