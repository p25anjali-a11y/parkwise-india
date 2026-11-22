/** Small dependency-free SVG charts for the operator console. Server-safe. Colours come from CSS variables. */

export function BarChart({ data, label, format = (n: number) => String(n), height = 180 }: { data: { label: string; value: number }[]; label: string; format?: (n: number) => string; height?: number }) {
  const W = 640, padL = 44, padB = 22, padT = 10, H = height;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - padL) / Math.max(1, data.length);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const every = Math.ceil(data.length / 8);
  return (
    <svg className="chart" role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 6} y={y(max * f) + 4} textAnchor="end">{format(Math.round(max * f))}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={i}>
          <rect x={padL + i * bw + bw * 0.18} y={y(d.value)} width={bw * 0.64} height={Math.max(0, H - padB - y(d.value))} rx="3" fill="var(--gold)">
            <title>{`${d.label}: ${format(d.value)}`}</title>
          </rect>
          {i % every === 0 && <text x={padL + i * bw + bw / 2} y={H - 6} textAnchor="middle">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Average occupancy by hour (IST). Bars use position and a legend as well as colour. */
export function HourChart({ profile }: { profile: (number | null)[] }) {
  const W = 640, H = 170, padL = 36, padB = 22, padT = 8;
  const bw = (W - padL) / 24;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v);
  const fill = (v: number) => (v >= 0.9 ? "var(--bad)" : v >= 0.7 ? "var(--warn)" : "var(--good)");
  return (
    <>
      <svg className="chart" role="img" aria-label="Average occupancy by hour of day" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W} y1={y(f)} y2={y(f)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(f) + 4} textAnchor="end">{Math.round(f * 100)}%</text>
          </g>
        ))}
        {profile.map((v, h) => (
          <g key={h}>
            {v === null
              ? <rect x={padL + h * bw + bw * 0.18} y={H - padB - 3} width={bw * 0.64} height={3} rx="1.5" fill="var(--line)"><title>{`${h}:00: no data`}</title></rect>
              : <rect x={padL + h * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={H - padB - y(v)} rx="3" fill={fill(v)}><title>{`${h}:00: ${Math.round(v * 100)}%`}</title></rect>}
            {h % 3 === 0 && <text x={padL + h * bw + bw / 2} y={H - 6} textAnchor="middle">{h}</text>}
          </g>
        ))}
      </svg>
      <div className="legend"><span><i style={{ background: "var(--good)" }} />under 70%</span><span><i style={{ background: "var(--warn)" }} />70 to 89%</span><span><i style={{ background: "var(--bad)" }} />90% and over</span></div>
    </>
  );
}
