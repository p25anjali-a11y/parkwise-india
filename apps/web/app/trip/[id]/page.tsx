import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveTrip } from "../../../components/LiveTrip";
import { hasSupabaseEnv } from "../../../lib/env";
import { getLang } from "../../../lib/lang";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Trip({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getLang();
  const { id } = await params;
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("id,name,address,city,lat,lng").eq("id", id).eq("status", "approved").maybeSingle();
  if (!lot) notFound();
  return (
    <main className="shell">
      <div className="top">
        <p style={{ margin: 0 }}><Link href={`/lots/${id}`}>← {t("back")}</Link></p>
        <h1 style={{ marginTop: 8 }}>{t("tripTitle")}</h1>
        <p>{lot.name} · {lot.address ?? lot.city}</p>
      </div>
      <LiveTrip lot={{ id: lot.id, name: lot.name, lat: lot.lat, lng: lot.lng }} />
    </main>
  );
}
