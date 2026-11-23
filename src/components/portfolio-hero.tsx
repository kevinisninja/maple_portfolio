"use client";

import { useMemo, useRef, useState } from "react";
import { mesos } from "@/lib/format";

type Point = { day: string; value: number };

const RANGES = [
  { key: "1W", days: 7, label: "Past week" },
  { key: "1M", days: 30, label: "Past month" },
  { key: "3M", days: 90, label: "Past 3 months" },
  { key: "1Y", days: 365, label: "Past year" },
  { key: "ALL", days: Infinity, label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const W = 1000; // viewBox units; the SVG stretches to its container
const H = 240;
const PAD_Y = 12;

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Robinhood-style hero: the big number is the chart's readout. Hovering (or
 * arrow keys) scrubs the date; the change line compares against the range start.
 */
export function PortfolioHero({
  history,
  liveTotal,
  today,
  title = "Net worth",
  emptyText = "Your value history appears here after your first full day.",
}: {
  history: Point[];
  liveTotal: number;
  today: string;
  title?: string;
  emptyText?: string;
}) {
  const [range, setRange] = useState<RangeKey>("1M");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Snapshot rows up to yesterday, plus today's live value so the line ends at the headline.
  const all = useMemo(() => [...history.filter((p) => p.day < today), { day: today, value: liveTotal }], [history, liveTotal, today]);

  const points = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (!Number.isFinite(r.days)) return all;
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - r.days);
    const iso = cutoff.toISOString().slice(0, 10);
    return all.filter((p) => p.day >= iso);
  }, [all, range, today]);

  const rangeMeta = RANGES.find((x) => x.key === range)!;
  const start = points[0]?.value ?? 0;
  const shown = hover != null ? points[hover] : points[points.length - 1];
  const value = shown?.value ?? liveTotal;
  const diff = value - start;
  const pctChange = start ? (diff / start) * 100 : null;
  const up = (points[points.length - 1]?.value ?? 0) >= start;
  const color = up ? "var(--up)" : "var(--down)";

  const { path, area, baselineY, xs, ys } = useMemo(() => {
    const vals = points.map((p) => p.value);
    let lo = Math.min(...vals, start);
    let hi = Math.max(...vals, start);
    if (hi === lo) {
      // Flat line: center it instead of pinning it to an edge.
      const pad = Math.max(1, Math.abs(hi) * 0.05);
      lo -= pad;
      hi += pad;
    }
    const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PAD_Y * 2);
    const n = points.length;
    const xs = points.map((_, i) => (n === 1 ? W : (i / (n - 1)) * W));
    const ys = points.map((p) => y(p.value));
    const path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const area = n > 1 ? `${path}L${W},${H}L0,${H}Z` : "";
    return { path, area, baselineY: y(start), xs, ys };
  }, [points, start]);

  const canChart = points.length >= 2;

  function indexFromClientX(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || points.length < 2) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (points.length - 1));
  }

  return (
    <section aria-label={`${title} chart`}>
      <div className="text-sm text-[var(--muted)]">{title}</div>
      <div className="mt-1 text-[clamp(2.25rem,7vw,3.5rem)] leading-none font-semibold tracking-tight">
        {value.toLocaleString("en-US")}
        <span className="ml-2 align-baseline text-base font-normal text-[var(--muted)]">mesos</span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
        {pctChange == null || diff === 0 ? (
          <span className="text-[var(--muted)]">No change</span>
        ) : (
          <span className={diff > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
            {diff > 0 ? "▲" : "▼"} {mesos(Math.abs(diff))} ({Math.abs(pctChange).toFixed(2)}%)
          </span>
        )}
        <span className="text-[var(--muted)]">{hover != null && shown ? formatDay(shown.day) : rangeMeta.label}</span>
      </div>

      <div className="relative mt-6">
        {canChart ? (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-56 w-full touch-none outline-none sm:h-64"
              tabIndex={0}
              role="img"
              aria-label={`${title} over ${rangeMeta.label.toLowerCase()}: from ${start.toLocaleString()} to ${points[points.length - 1].value.toLocaleString()} mesos. Use left and right arrow keys to inspect days.`}
              onPointerMove={(e) => setHover(indexFromClientX(e.clientX))}
              onPointerDown={(e) => setHover(indexFromClientX(e.clientX))}
              onPointerLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const last = points.length - 1;
                const cur = hover ?? last;
                setHover(Math.min(last, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1))));
              }}
            >
              <defs>
                <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Range-start reference, like Robinhood's dotted previous-close line */}
              <line
                x1={0}
                x2={W}
                y1={baselineY}
                y2={baselineY}
                stroke="var(--muted)"
                strokeOpacity={0.5}
                strokeDasharray="2 6"
                vectorEffect="non-scaling-stroke"
              />
              <path d={area} fill="url(#hero-fill)" />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {hover != null && (
                <line
                  x1={xs[hover]}
                  x2={xs[hover]}
                  y1={0}
                  y2={H}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {/* Dot as HTML so it stays round while the SVG stretches */}
            {hover != null && (
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--card)]"
                style={{ left: `${(xs[hover] / W) * 100}%`, top: `${(ys[hover] / H) * 100}%`, background: color }}
              />
            )}
          </>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)] sm:h-64">
            {emptyText}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1 border-b border-[var(--border)]" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === range}
            onClick={() => {
              setRange(r.key);
              setHover(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              r.key === range ? "" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            style={r.key === range ? { borderColor: color } : undefined}
          >
            {r.key}
          </button>
        ))}
      </div>
    </section>
  );
}
