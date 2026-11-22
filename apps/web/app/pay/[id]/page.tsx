import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "../../../lib/env";
import { getLang } from "../../../lib/lang";
import { supabaseServer } from "../../../lib/supabase/server";
import { PayPortal } from "../../../components/PayPortal";

export const dynamic = "force-dynamic";

export default async function Pay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getLang();
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const sb = await supabaseServer();
  const { data: r } = await sb.from("reservations").select("id,status,total_paise,hold_expires_at,arrival_at,duration_min,lot_id,lots(name)").eq("id", id).maybeSingle();
  if (!r) notFound();
  const paid = ["confirmed", "checked_in", "completed"].includes(r.status);
  return (
    <main className="shell">
      <div className="top"><h1>{t("payTitle")}</h1></div>
      <PayPortal reservationId={r.id} lotId={r.lot_id} lotName={(r.lots as unknown as { name: string } | null)?.name ?? "Parking"} totalPaise={r.total_paise} holdExpiresAt={r.hold_expires_at} arrivalAt={r.arrival_at} durationMin={r.duration_min} alreadyPaid={paid} />
    </main>
  );
}
