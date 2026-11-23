/** Tiny trend line. Pure SVG; safe in server and client components. */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-[var(--muted)]" aria-hidden>—</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--up)" : "var(--down)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
