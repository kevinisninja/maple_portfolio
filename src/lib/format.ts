export { SERVER_LABELS } from "./servers";

/** Compact meso display: 1.25B, 340M, 12.5K */
export function mesos(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) =>
    `${(n < 0 ? -v : v).toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 })}${suffix}`;
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e4) return fmt(abs / 1e3, "K");
  return n.toLocaleString("en-US");
}

export function fullMesos(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toLocaleString("en-US")} mesos`;
}

export function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
