"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase/browser";

export type Live = { lot_id: string; occupied: number; capacity: number; updated_at: string; is_synthetic: boolean };
export type LotRow = { id: string; name: string; city: string; status: string; category: string; live: Live | null };

export function pct(l: Pick<Live, "occupied" | "capacity">) {
  return l.capacity > 0 ? Math.min(100, Math.round((l.occupied / l.capacity) * 100)) : 0;
}

/** Lot cards that update in place via Supabase Realtime on lot_live_state. */
export function LiveLots({ lots }: { lots: LotRow[] }) {
  const [live, setLive] = useState<Record<string, Live>>(
    Object.fromEntries(lots.flatMap((l) => (l.live ? [[l.id, l.live]] : []))),
  );
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel("lot_live_state")
      .on("postgres_changes", { event: "*", schema: "public", table: "lot_live_state" }, (p) => {
        const r = p.new as Live;
        if (r?.lot_id) setLive((cur) => ({ ...cur, [r.lot_id]: r }));
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);
  return (
    <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
      {lots.map((l) => {
        const s = live[l.id];
        const p = s ? pct(s) : 0;
        return (
          <li key={l.id} data-testid="lot-card" style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <Link href={`/operator/lots/${l.id}`}><strong>{l.name}</strong></Link> · {l.city} · {l.category} · <em>{l.status}</em>
            <div style={{ background: "#eee", height: 8, borderRadius: 4, margin: "8px 0" }}>
              <div style={{ width: `${p}%`, height: 8, borderRadius: 4, background: p >= 90 ? "#c0392b" : p >= 70 ? "#e67e22" : "#27ae60" }} />
            </div>
            {s ? (
              <span>{s.occupied}/{s.capacity} cars ({p}%){s.is_synthetic ? " · synthetic demo data" : ""}</span>
            ) : (
              <span>No live feed yet</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
