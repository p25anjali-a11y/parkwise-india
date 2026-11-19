import Link from "next/link";
import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";
import { getLang } from "../../lib/lang";
import { LangSwitch } from "../../components/I18n";
import { Mascot } from "../../components/Mascot";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { t } = await getLang();
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const meta = (user?.user_metadata ?? {}) as { car_model?: string; car_plate?: string };
  return (
    <main className="shell">
      <div className="top">
        <div className="row"><Mascot size={64} /><div><h1>{t("welcome")}</h1><p>{t("signedInAs")} {user?.email} ({profile?.role ?? "driver"})</p></div></div>
      </div>
      {(meta.car_model || meta.car_plate) && (
        <div className="card lift"><div className="muted">🚗 {t("yourCar")}</div><h3 style={{ marginBottom: 0 }}>{meta.car_model} {meta.car_plate && <span className="pill demo">{meta.car_plate}</span>}</h3></div>
      )}
      <Link href="/driver/reservations" className="btn blue block" style={{ marginBottom: 12 }}>🎟️ {t("myReservations")}</Link>
      <Link href="/search" className="btn block" style={{ marginBottom: 12 }}>🔎 {t("findTitle")}</Link>
      <div className="card"><div className="muted" style={{ marginBottom: 8 }}>{t("language")}</div><LangSwitch /></div>
      <form action="/auth/signout" method="post"><button type="submit" className="btn ghost block">{t("signOut")}</button></form>
    </main>
  );
}
