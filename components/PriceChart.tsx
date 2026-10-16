import { OUTCOME_COLORS } from "@/lib/constants";

export interface PriceChartPoint {
  createdAt: string | Date;
  probs: number[];
}

export interface PriceChartOutcome {
  id: string;
  label: string;
}

const W = 640;
const H = 230;
const L = 44;
const R = 58;
const T = 12;
const B = 28;
const IW = W - L - R;
const IH = H - T - B;

export function PriceChart({
  outcomes,
  history,
}: {
  outcomes: PriceChartOutcome[];
  history: PriceChartPoint[];
}) {
  if (history.length === 0) return null;
  const n = history.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * IW);
  const y = (p: number) => T + (1 - p) * IH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((v) => (
    <g key={v}>
      <line x1={L} x2={L + IW} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
      <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] font-mono">
        {v * 100}%
      </text>
    </g>
  ));

  const lines = outcomes.map((o, k) => {
    const points =
      n <= 1
        ? `${x(0)},${y(history[0].probs[k])} ${L + IW},${y(history[0].probs[k])}`
        : history.map((row, i) => `${x(i).toFixed(1)},${y(row.probs[k]).toFixed(1)}`).join(" ");
    return (
      <polyline
        key={o.id}
        points={points}
        fill="none"
        stroke={OUTCOME_COLORS[k % OUTCOME_COLORS.length]}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  });

  const labels = outcomes.map((o, k) => ({
    id: o.id,
    k,
    value: history[n - 1].probs[k],
    y: y(history[n - 1].probs[k]),
  }));
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  }
  const last = labels.length - 1;
  if (last >= 0 && labels[last].y > T + IH) labels[last].y = T + IH;
  for (let i = last - 1; i >= 0; i--) {
    if (labels[i + 1].y - labels[i].y < 14) labels[i].y = labels[i + 1].y - 14;
  }

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Koersverloop van de kansen" className="block w-full">
        {gridLines}
        {lines}
        {labels.map((l) => (
          <g key={l.id}>
            <circle
              cx={L + IW}
              cy={y(l.value)}
              r={3.5}
              style={{ fill: OUTCOME_COLORS[l.k % OUTCOME_COLORS.length] }}
            />
            <text
              x={L + IW + 9}
              y={l.y + 4}
              className="text-xs font-semibold font-mono"
              style={{ fill: OUTCOME_COLORS[l.k % OUTCOME_COLORS.length] }}
            >
              {(l.value * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <text x={L} y={H - 8} className="fill-muted text-[11px] font-mono">
          start
        </text>
        <text x={L + IW} y={H - 8} textAnchor="end" className="fill-muted text-[11px] font-mono">
          nu, na {n - 1} {n - 1 === 1 ? "transactie" : "transacties"}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Kans per uitkomst na elke transactie</figcaption>
    </figure>
  );
}
