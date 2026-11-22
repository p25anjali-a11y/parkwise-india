"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase/browser";
import { useT } from "./I18n";

export type Live = { lot_id: string; occupied: number; capacity: number; updated_at: string; is_synthetic: boolean };
export type LotRow = { id: string; name: string; city: string; status: string; category: string; live: Live | null };

export function pct(l: Pick<Live, "occupied" | "capacity">) {
  return l.capacity > 0 ? Math.min(100, Math.round((l.occupied / l.capacity) * 100)) : 0;
}

/** Lot cards that update in place via Supabase Realtime on lot_live_state. */
export function LiveLots({ lots }: { lots: LotRow[] }) {
  const { t } = useT();
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
    <div className="grid2" style={{ marginBottom: 12 }}>
      {lots.map((l) => {
        const s = live[l.id];
        const p = s ? pct(s) : 0;
        return (
          <div key={l.id} data-testid="lot-card" className="card">
            <div className="rowb"><Link href={`/operator/lots/${l.id}`}><strong>{l.name}</strong></Link><span>{s?.is_synthetic && <span className="sim-mark">{t("simulatedBadge")}</span>} <span className={`pill ${l.status === "approved" ? "green" : "grey"}`}>{l.status}</span></span></div>
            <div className="muted" style={{ margin: "2px 0 10px" }}>{l.city} · {l.category}</div>
            <div className="bar"><div style={{ width: `${p}%`, background: p >= 90 ? "var(--bad)" : p >= 70 ? "var(--warn)" : "var(--good)" }} /></div>
            <p style={{ margin: "8px 0 0" }}>{s ? <>{s.occupied}/{s.capacity} cars ({p}%)</> : <span className="muted">No live feed yet</span>}</p>
          </div>
        );
      })}
    </div>
  );
}
