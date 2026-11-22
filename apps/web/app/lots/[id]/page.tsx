import Link from "next/link";
import { notFound } from "next/navigation";
import { quote, DEFAULT_RULES, type PricingRules } from "@parkwise/pricing";
import { QuoteForm } from "../../../components/QuoteForm";
import { EtaButton } from "../../../components/EtaButton";
import { availabilityNow } from "../../../lib/geo";
import { resolveOccupancy } from "../../../lib/resolve-occupancy";
import { liveTrafficRows, liveWeatherRows, rainProbAt } from "../../../lib/live-signals";
import { signalsFor } from "../../../lib/quote-inputs";
import { supabaseServer } from "../../../lib/supabase/server";
import { getLang } from "../../../lib/lang";
import { LiveLotSim } from "../../../components/LiveLotSim";
import { BestTime } from "../../../components/BestTime";
import { AlertForm } from "../../../components/AlertForm";
import { WaitlistButton } from "../../../components/WaitlistButton";
import { loadSeries } from "../../../lib/lot-series";
import { MiniMap } from "../../../components/MiniMap";
import { ICON } from "../../../components/icons";
import { mapsDirections } from "../../../lib/map-style";

export const dynamic = "force-dynamic";

export default async function LotDetail({ params }: { params: Promise<{ id: string }> }) {
  const { t, tl } = await getLang();
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,name,city,address,category,lat,lng,is_synthetic,data_source,data_as_of").eq("id", id).eq("status", "approved").maybeSingle();
  if (!lot) notFound();
  const { data: live } = await sb.from("lot_live_state").select("occupied,capacity,updated_at,source,is_synthetic").eq("lot_id", id).maybeSingle();
  const { data: rr } = await sb.from("price_rules").select("rules").eq("lot_id", id).eq("active", true).is("zone_id", null).maybeSingle();
  const rules = { ...DEFAULT_RULES, ...((rr?.rules as Partial<PricingRules>) ?? {}) } as PricingRules;
  const { data: zones } = await sb.from("zones").select("capacity").eq("lot_id", id);
  const capacity = live?.capacity ?? (zones ?? []).reduce((n, z) => n + z.capacity, 0);
  const now = new Date();
  const rows = [...(await liveWeatherRows(lot.city, now)), ...(await liveTrafficRows({ lat: lot.lat, lng: lot.lng }, now))];
  const occ = resolveOccupancy({ lot, forecast: null, live: live ?? null, arrival: now, now, rainProb: rainProbAt(rows, now) });
  const { signals, inputs } = signalsFor(rows, now, now);
  const q = quote({ lotId: id, zoneId: "now", rules, predictedOccupancy: occ.value, arrivalTime: now, durationMin: 60, signals, inputs: [occ.input, ...inputs] });
  const ser = await loadSeries(sb, id, 7);
  const { data: { user } } = await sb.auth.getUser();
  const { data: wl } = user ? await sb.from("waitlist").select("id").eq("lot_id", id).eq("user_id", user.id).maybeSingle() : { data: null };
  const { data: evz } = await sb.from("zones").select("capacity,slot_types!inner(code)").eq("lot_id", id).eq("slot_types.code", "ev");
  const evBays = (evz ?? []).reduce((n, z) => n + z.capacity, 0);
  const nearlyFull = occ.value !== null && occ.value >= 0.9;
  const label = occ.value === null ? "No live availability" : availabilityNow(Math.round(occ.value * 100), 100);
  const tone = label === "Nearly full" ? "red" : label === "Tight" ? "orange" : label === "Likely space" ? "green" : "grey";
  const rupees = Math.round(q.ratePerHour / 100);
  return (
    <main className="shell lotpage">
      <div className="top">
        <p style={{ margin: 0 }}><Link href="/search">← {t("back")}</Link></p>
        <h1 style={{ marginTop: 8 }}>{lot.name}</h1>
        <p>{lot.address ?? lot.city} · {lot.category}</p>
      </div>
      <div className="lotgrid">
        <div>
          <div className="card lift">
            <div className="hero-price">
              <span className="price">₹{rupees}<small style={{ fontSize: 14 }}>{t("perHour")}</small></span>
              <span className={`pill ${tone}`}>{tl(label)}</span>
            </div>
            <p style={{ margin: "8px 0 0" }}><span className="pill demo">{tl(q.label)}</span> {occ.simulated && <span className="pill demo">{t("simulatedBadge")}</span>}</p>
            {occ.value !== null && capacity > 0 && (
              <div className="statrow">
                <div><b>{Math.max(0, Math.round(capacity * (1 - occ.value)))}</b><span>{t("freeNow")}</span></div>
                <div><b>{Math.round(occ.value * 100)}%</b><span>{t("fullNow")}</span></div>
                <div><b>{capacity}</b><span>{t("totalBays")}</span></div>
              </div>
            )}
            {occ.simulated && <p role="note" className="muted" style={{ marginBottom: 0 }}>{t("simulatedNote")}</p>}
            {!occ.simulated && occ.value !== null && live && <p className="muted" style={{ marginBottom: 0 }}>{live.occupied}/{live.capacity} · {new Date(live.updated_at).toLocaleTimeString("en-IN")}</p>}
            {occ.value === null && <p className="muted" style={{ marginBottom: 0 }}>{t("noLiveExplain")}</p>}
            {lot.data_source && <p className="muted" style={{ marginBottom: 0 }}>Lot details from {lot.data_source}, as of {lot.data_as_of}.</p>}
          </div>
          {occ.value !== null && capacity > 0 && <LiveLotSim lotId={id} capacity={capacity} initial={occ.value} simulated={occ.simulated} />}
          {nearlyFull && <div className="card" data-testid="waitlist"><h2>{t("waitTitle")}</h2><p className="muted">{t("waitSub")}</p><WaitlistButton lotId={id} joined={!!wl} /></div>}
          {evBays > 0 && <div className="card" data-testid="ev-bays"><h2>{t("evBays")}</h2><p style={{ marginBottom: 0 }}><span className="price">{evBays}</span> {occ.value !== null && <span className="muted">· ~{Math.max(0, Math.round(evBays * (1 - occ.value)))} {t("evEst")}</span>}</p></div>}
          {ser && <BestTime series={ser.series} t={t} />}
          <div className="card">
            <h2>{t("whyPrice")}</h2>
            <ol className="steps">{q.breakdown.map((s, i) => <li key={i}><span>{s.label}</span><strong>{s.multiplier.toFixed(2)}x</strong></li>)}</ol>
            <p className="muted" style={{ marginBottom: 0 }}>Inputs: {q.inputs.map((i) => `${i.name} ${i.status}${i.source ? ` (${i.source})` : ""}`).join("; ")}.</p>
          </div>
        </div>
        <div className="side">
          <MiniMap lat={lot.lat} lng={lot.lng} label={label} rate={q.ratePerHour} name={lot.name} />
          <div className="card">
            <h2>{t("getThere")}</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Link href={`/trip/${id}`} className="btn block" data-testid="start-trip">{ICON.nav}&nbsp;{t("startTrip")}</Link>
              <a href={mapsDirections(lot.lat, lot.lng)} target="_blank" rel="noopener noreferrer" className="btn ghost block">{t("openInMaps")}</a>
            </div>
            <div style={{ marginTop: 12 }}><EtaButton lotId={id} /></div>
          </div>
          <div className="card"><QuoteForm lotId={id} /></div>
          <div className="card"><AlertForm lotId={id} suggested={Math.max(1, Math.floor(q.ratePerHour / 100 - 5))} /></div>
        </div>
      </div>
    </main>
  );
}
