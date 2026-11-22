"use client";
import { useEffect, useState } from "react";
import { fullRange } from "../lib/availability-range";
import { useT } from "./I18n";

/**
 * How busy the lot is, as a moving range rather than an exact count. The highlighted band drifts gently so it reads as
 * live; the numbers beside it are the steady range. Exact car movements are shown to operators only.
 */
export function AvailabilityRange({ occupancy, capacity, simulated }: { occupancy: number; capacity: number; simulated: boolean }) {
  const { t } = useT();
  const r = fullRange(occupancy, capacity);
  const [drift, setDrift] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setDrift(Math.round((Math.random() * 2 - 1) * 3)), 2200);
    return () => clearInterval(id);
  }, []);
  const lo = Math.max(0, Math.min(100, r.loPct + drift));
  const hi = Math.max(lo + 10, Math.min(100, r.hiPct + drift));
  return (
    <div className="rangecard" data-testid="availability-range">
      <div className="rangehead">
        <span><b>{t("rangeFree", { lo: r.freeLo, hi: r.freeHi })}</b></span>
        <span className="muted">{t("rangeFull", { lo: r.loPct, hi: r.hiPct })}</span>
      </div>
      <div className="rangebar" role="img" aria-label={t("rangeFull", { lo: r.loPct, hi: r.hiPct })}>
        <div className="band" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>{t("rangeNote")}{simulated ? ` ${t("simulatedBadge")}` : ""}</p>
    </div>
  );
}
