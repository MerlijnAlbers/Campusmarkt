const WIDTH = 120;
const HEIGHT = 32;
const PADDING = 3;

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;

  const x = (i: number) =>
    values.length <= 1 ? 0 : (i / (values.length - 1)) * WIDTH;
  const y = (v: number) => PADDING + (1 - v) * (HEIGHT - PADDING * 2);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPoints = `0,${HEIGHT} ${points} ${WIDTH},${HEIGHT}`;
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-8 w-full"
      role="img"
      aria-label="Koersverloop van de leidende uitkomst over de afgelopen 7 dagen"
    >
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
