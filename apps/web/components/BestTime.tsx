import { suggestBest } from "../lib/best-time";
import type { SeriesPoint } from "../lib/price-series";

type T = (k: string, v?: Record<string, string | number>) => string;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Next hours at a glance with the cheapest one marked, plus the "arrive later, pay less" nudge. Server component. */
export function BestTime({ series, t }: { series: SeriesPoint[]; t: T }) {
  const best = suggestBest(series);
  if (!best) return null;
  const max = Math.max(...series.map((s) => s.ratePerHour), 1);
  const cheapest = Math.min(...series.map((s) => s.ratePerHour));
  return (
    <div className="card" data-testid="best-time">
      <h2>{t("bestTimeTitle")}</h2>
      {best.kind === "later"
        ? <p><strong>{t("saveLine", { time: hhmm(best.best.at), amt: (best.savingPaise / 100).toFixed(0), pct: best.savingPct })}</strong></p>
        : <p><strong>{t("cheapestNow")}</strong></p>}
      <div style={{ display: "grid", gap: 6 }}>
        {series.map((s) => (
          <div key={s.at} style={{ display: "grid", gridTemplateColumns: "64px 1fr 56px", alignItems: "center", gap: 8 }}>
            <span className="muted">{hhmm(s.at)}</span>
            <div className="bar"><div style={{ width: `${(s.ratePerHour / max) * 100}%`, background: s.ratePerHour === cheapest ? "var(--green)" : "var(--blue)" }} /></div>
            <strong>₹{(s.ratePerHour / 100).toFixed(0)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
