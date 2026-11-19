"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "./I18n";

const COLS = 8;
const ROWS = 5;
const N = COLS * ROWS;
const COLOURS = ["#2f6bff", "#ff6fa8", "#ffc83d", "#22b573", "#ff8a3d", "#7b5cff"];
// 0 free, 1 parked, 2 just arrived, 3 leaving
type Bay = 0 | 1 | 2 | 3;

function seeded(initial: number): Bay[] {
  const n = Math.round(initial * N);
  // deterministic spread so server and client render the same first frame
  return Array.from({ length: N }, (_, i) => ((i * 7) % N < n ? 1 : 0) as Bay);
}

/**
 * A top-down picture of the lot with cars coming and going. How full it is follows the lot's occupancy
 * (simulated for demo lots, real for lots with live counts); the individual cars are illustration.
 */
export function LiveLotSim({ lotId, capacity, initial, simulated }: { lotId: string; capacity: number; initial: number; simulated: boolean }) {
  const { t } = useT();
  const [bays, setBays] = useState<Bay[]>(() => seeded(initial));
  const [frac, setFrac] = useState(initial);
  const [ins, setIns] = useState(0);
  const [outs, setOuts] = useState(0);
  const fracRef = useRef(frac);
  fracRef.current = frac;

  useEffect(() => {
    let on = true;
    const poll = () =>
      fetch(`/api/availability?lotId=${lotId}&arrivalInMin=0`)
        .then((r) => r.json())
        .then((a) => {
          if (on && a.available && capacity > 0) setFrac(Math.min(1, Math.max(0, 1 - a.freeBays.likely / capacity)));
        })
        .catch(() => {});
    const id = setInterval(poll, 20000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [lotId, capacity]);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = setInterval(() => {
      setBays((cur) => {
        const next = cur.map((b) => (b === 2 ? 1 : b === 3 ? 0 : b)) as Bay[];
        const parked = next.filter((b) => b === 1).length;
        const target = Math.round(fracRef.current * N);
        const free = next.flatMap((b, i) => (b === 0 ? [i] : []));
        const taken = next.flatMap((b, i) => (b === 1 ? [i] : []));
        const wantIn = parked < target || (parked === target && Math.random() < 0.5);
        if (wantIn && free.length) {
          next[free[Math.floor(Math.random() * free.length)]!] = 2;
          setIns((x) => x + 1);
        } else if (taken.length) {
          next[taken[Math.floor(Math.random() * taken.length)]!] = 3;
          setOuts((x) => x + 1);
        }
        return next;
      });
    }, reduce ? 4000 : 1400);
    return () => clearInterval(tick);
  }, []);

  const parked = bays.filter((b) => b === 1 || b === 2).length;
  const pct = Math.round((parked / N) * 100);
  const W = 40, H = 54, gx = 10, gy = 12, left = 24, top = 70;
  const width = left * 2 + COLS * W + (COLS - 1) * gx;
  const height = top + ROWS * H + (ROWS - 1) * gy + 24;
  return (
    <div className="lotsim" data-testid="live-lot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${t("liveTitle")}: ${pct}% ${t("full")}`}>
        <rect x="0" y="0" width={width} height={height} rx="14" fill="#2a3052" />
        <rect x={width / 2 - 40} y="0" width="80" height="12" fill="#ffc83d" />
        <text x={width / 2} y="32" textAnchor="middle" fill="#ffc83d" fontSize="14" fontWeight="800">GATE ▼</text>
        {bays.map((b, i) => {
          const c = i % COLS, r = Math.floor(i / COLS);
          const x = left + c * (W + gx), y = top + r * (H + gy);
          return (
            <g key={i}>
              <rect className="bay" x={x} y={y} width={W} height={H} rx="6" />
              {b !== 0 && (
                <g className="car" style={{ opacity: b === 3 ? 0.25 : 1 }}>
                  <rect x={x + 6} y={y + 6} width={W - 12} height={H - 12} rx="9" fill={b === 2 ? "#22b573" : COLOURS[i % COLOURS.length]} />
                  <rect x={x + 10} y={y + 12} width={W - 20} height="12" rx="4" fill="#dbe7ff" opacity="0.9" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="bar" style={{ marginTop: 10, background: "#4a5278" }}>
        <div style={{ width: `${pct}%`, background: pct >= 90 ? "#f0455a" : pct >= 70 ? "#ff8a3d" : "#22b573" }} />
      </div>
      <div className="stats">
        <div><b>{pct}%</b>{t("full")}</div>
        <div><b>{ins}</b>{t("carsIn")}</div>
        <div><b>{outs}</b>{t("carsOut")}</div>
      </div>
      {simulated && <p style={{ margin: "10px 0 0", fontSize: 14, opacity: 0.9 }}>{t("liveSub")}</p>}
    </div>
  );
}
