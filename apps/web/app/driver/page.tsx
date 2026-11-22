import Link from "next/link";
import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";
import { getLang } from "../../lib/lang";
import { LangSwitch } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";
import { AddCar } from "../../components/AddCar";
import { RemoveButton } from "../../components/RemoveButton";
import { loadSeries } from "../../lib/lot-series";
import { ClaimReferral } from "../../components/ClaimReferral";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { t } = await getLang();
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const meta = (user?.user_metadata ?? {}) as { car_model?: string; car_plate?: string };
  const { data: cars } = await sb.from("vehicles").select("id,label,plate_last4").eq("user_id", user?.id ?? "").order("created_at");
  const { data: alertRows } = await sb.from("price_alerts").select("id,lot_id,target_rate_paise,lots(name)").eq("user_id", user?.id ?? "").order("created_at").limit(10);
  const alerts = await Promise.all((alertRows ?? []).map(async (a) => {
    const now = (await loadSeries(sb, a.lot_id, 1))?.series[0]?.ratePerHour ?? null;
    return { id: a.id, name: (a.lots as unknown as { name: string } | null)?.name ?? "Lot", target: a.target_rate_paise, now };
  }));
  const { data: wlRows } = await sb.from("waitlist").select("id,lot_id,lots(name)").eq("user_id", user?.id ?? "").order("created_at").limit(10);
  const waits = await Promise.all((wlRows ?? []).map(async (w) => {
    const occ = (await loadSeries(sb, w.lot_id, 1))?.series[0]?.occupancy ?? null;
    return { id: w.id, name: (w.lots as unknown as { name: string } | null)?.name ?? "Lot", lotId: w.lot_id, free: occ !== null && occ < 0.8 };
  }));
  return (
    <main className="shell">
      <div className="top">
        <div className="row"><Mascot size={64} /><div><h1>{t("welcome")}</h1><p>{t("signedInAs")} {user?.is_anonymous ? t("guestName") : user?.email} ({profile?.role ?? "driver"})</p></div></div>
      </div>
      <ClaimReferral />
      {(meta.car_model || meta.car_plate) && (
        <div className="card lift"><div className="muted">{t("yourCar")}</div><h3 style={{ marginBottom: 0 }}>{meta.car_model} {meta.car_plate && <span className="pill demo">{meta.car_plate}</span>}</h3></div>
      )}
      <div className="card" data-testid="saved-cars">
        <h2>{t("savedCars")}</h2>
        {(cars ?? []).length === 0 && <p className="muted">{t("noCars")}</p>}
        {(cars ?? []).map((c) => (
          <div className="rowb" key={c.id} style={{ marginBottom: 8 }}><span>{c.label} <span className="pill demo">•• {c.plate_last4}</span></span><RemoveButton url={`/api/vehicles?id=${c.id}`} /></div>
        ))}
        <AddCar />
      </div>
      <div className="card" data-testid="my-waitlist">
        <h2>{t("myWaitlist")}</h2>
        {waits.length === 0 && <p className="muted">{t("noWaitlist")}</p>}
        {waits.map((w) => (
          <div className="rowb" key={w.id} style={{ marginBottom: 8 }}>
            <span><Link href={`/lots/${w.lotId}`}><strong>{w.name}</strong></Link><br /><span className={`pill ${w.free ? "green" : "grey"}`}>{w.free ? t("waitFree") : t("waitWaiting")}</span></span>
            <RemoveButton url={`/api/waitlist?id=${w.id}`} />
          </div>
        ))}
      </div>
      <div className="card" data-testid="my-alerts">
        <h2>{t("myAlerts")}</h2>
        {alerts.length === 0 && <p className="muted">{t("noAlerts")}</p>}
        {alerts.map((a) => {
          const hit = a.now !== null && a.now <= a.target;
          return (
            <div className="rowb" key={a.id} style={{ marginBottom: 8 }}>
              <span><strong>{a.name}</strong> · ≤ ₹{(a.target / 100).toFixed(0)}<br /><span className={`pill ${hit ? "green" : "grey"}`}>{a.now === null ? "—" : hit ? t("alertReached", { p: (a.now / 100).toFixed(0) }) : t("alertWaiting", { p: (a.now / 100).toFixed(0) })}</span></span>
              <RemoveButton url={`/api/alerts?id=${a.id}`} />
            </div>
          );
        })}
      </div>
      {profile?.role && profile.role !== "driver"
        ? <Link href={profile.role === "platform_admin" ? "/admin" : "/operator"} className="btn green block" style={{ marginBottom: 12 }}>{t("openOperator")}</Link>
        : <div className="card"><h3>{t("runLotCard")}</h3><p className="muted">{t("runLotSub")}</p><Link href="/become-operator" className="btn green block">{t("joinTitle")}</Link></div>}
      <Link href="/driver/reservations" className="btn blue block" style={{ marginBottom: 12 }}>{t("myReservations")}</Link>
      <Link href="/rewards" className="btn ghost block" style={{ marginBottom: 12 }}>{t("rewardsTitle")}</Link>
      <Link href="/search" className="btn block" style={{ marginBottom: 12 }}>{t("findTitle")}</Link>
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
      <form action="/auth/signout" method="post"><button type="submit" className="btn ghost block">{t("signOut")}</button></form>
    </main>
  );
}
