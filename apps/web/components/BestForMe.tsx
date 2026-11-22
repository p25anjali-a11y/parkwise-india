"use client";
import Link from "next/link";
import { useState } from "react";
import { freeRangeFromBays } from "../lib/availability-range";
import { rankForTrip, hasSpace, type Candidate } from "../lib/trip-plan";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Row = Candidate & { name: string; lo: number; hi: number };
type Lot = { id: string; name: string; rate: number; label: string };

/** "Book for me": checks travel time and expected free spaces for the nearest few places and puts the best match with space on top. */
export function BestForMe({ lots, me, onLocate }: { lots: Lot[]; me: { lat: number; lng: number } | null; onLocate: () => void }) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!me) return onLocate();
    setBusy(true);
    const out = await Promise.all(lots.slice(0, 4).map(async (l): Promise<Row | null> => {
      try {
        const er = await fetch(`/api/eta?lotId=${l.id}&lat=${me.lat}&lng=${me.lng}`);
        if (!er.ok) return null;
        const eta = (await er.json()) as { minutes: number };
        const ar = await fetch(`/api/availability?lotId=${l.id}&arrivalInMin=${Math.ceil((eta.minutes + 5) / 5) * 5}`);
        const av = ar.ok ? ((await ar.json()) as { available: boolean; label?: string; freeBays?: { pessimistic: number; optimistic: number } }) : null;
        const [lo, hi] = av?.available && av.freeBays ? freeRangeFromBays(av.freeBays.pessimistic, av.freeBays.optimistic) : [0, 0];
        return { id: l.id, name: l.name, etaMin: eta.minutes, freeHi: hi, lo, hi, rate: l.rate, label: av?.label ?? l.label };
      } catch { return null; }
    }));
    setRows(rankForTrip(out.filter((x): x is Row => x !== null) as Row[]) as Row[]);
    setBusy(false);
  }

  const good = rows?.filter(hasSpace) ?? [];
  return (
    <section className="card" data-testid="best-for-me" style={{ margin: "0 0 12px" }}>
      <h2 style={{ marginTop: 0 }}>{t("bestForMeTitle")}</h2>
      {!rows && <button type="button" className="btn blue block" style={{ minHeight: 48 }} onClick={() => void run()} disabled={busy}>{ICON.locate}&nbsp;{busy ? t("bestLoading") : me ? t("bestForMeBtn") : t("needLocation")}</button>}
      {rows && good.length === 0 && <p role="status" className="muted">{t("bestNone")}</p>}
      {good.map((r, i) => (
        <div key={r.id} className="rowb" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>
          <div>
            {i === 0 && <span className="pill green">{t("bestTop")}</span>} <strong>{r.name}</strong>
            <div className="muted">{t("bestWhy", { min: r.etaMin, lo: r.lo, hi: r.hi, rate: Math.round(r.rate / 100) })}</div>
          </div>
          <Link href={`/lots/${r.id}?auto=1`} className="btn blue" style={{ minHeight: 44 }}>{t("bestBook")}</Link>
        </div>
      ))}
    </section>
  );
}
