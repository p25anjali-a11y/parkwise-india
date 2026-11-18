import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Reservations() {
  const sb = await supabaseServer();
  const { data } = await sb.from("reservations").select("id,status,arrival_at,duration_min,total_paise,hold_expires_at,lots(name)").order("created_at", { ascending: false }).limit(50);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p><Link href="/driver">← Back</Link></p>
      <h1>Your reservations</h1>
      {(data ?? []).length === 0 && <p>No reservations yet.</p>}
      <ul>
        {(data ?? []).map((r) => (
          <li key={r.id}>
            {(r.lots as unknown as { name: string } | null)?.name ?? "Lot"} · {new Date(r.arrival_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {r.duration_min / 60} h · ₹{(r.total_paise / 100).toFixed(0)} · <strong>{r.status}</strong>
          </li>
        ))}
      </ul>
    </main>
  );
}
