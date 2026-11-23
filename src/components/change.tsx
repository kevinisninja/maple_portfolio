import { mesos, pct } from "@/lib/format";

export function Change({ cur, prev, showAbs = true }: { cur: number; prev: number; showAbs?: boolean }) {
  const diff = cur - prev;
  const p = pct(cur, prev);
  if (diff === 0 || p === null) return <span className="text-[var(--muted)]">—</span>;
  const up = diff > 0;
  return (
    <span className={up ? "text-[var(--up)]" : "text-[var(--down)]"}>
      {up ? "▲" : "▼"} {showAbs && `${mesos(Math.abs(diff))} `}({Math.abs(p).toFixed(2)}%)
    </span>
  );
}
