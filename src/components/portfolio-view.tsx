import type { HoldingRow } from "@/lib/portfolio";
import { SERVER_LABELS, type Server } from "@/lib/servers";
import { mesos, fullMesos } from "@/lib/format";
import { todayUtc } from "@/lib/dates";
import { PortfolioHero } from "./portfolio-hero";
import { HoldingsList } from "./holdings-list";
import { Change } from "./change";

export function PortfolioView({
  holdings,
  history,
  sparks,
  server,
  editable = false,
  title,
}: {
  holdings: HoldingRow[];
  history: { day: string; value: number }[];
  sparks: Map<number, { day: string; price: number }[]>;
  server: Server;
  editable?: boolean;
  title?: string;
}) {
  const today = todayUtc();
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const prevTotal = holdings.reduce((s, h) => s + h.prevValue, 0);
  const best = history.reduce((m, h) => Math.max(m, h.value), total);
  const units = holdings.reduce((s, h) => s + h.quantity, 0);

  const rows = holdings.map((h) => {
    const series = (sparks.get(h.itemId) ?? []).filter((p) => p.day < today).map((p) => p.price);
    if (h.price != null) series.push(h.price); // end on the live price
    return {
      itemId: h.itemId,
      name: h.name,
      category: h.category,
      iconUrl: h.iconUrl,
      quantity: h.quantity,
      price: h.price,
      priceDay: h.priceDay,
      value: h.value,
      prevValue: h.prevValue,
      spark: series,
    };
  });

  return (
    <div className="space-y-10">
      <PortfolioHero
        history={history}
        liveTotal={total}
        today={today}
        title={title ?? `Net worth · ${SERVER_LABELS[server]}`}
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Today" value={<Change cur={total} prev={prevTotal} />} />
        <Stat label="All-time high" value={<span title={fullMesos(best)}>{mesos(best)}</span>} />
        <Stat label="Item types" value={holdings.length.toLocaleString()} />
        <Stat label="Total units" value={units.toLocaleString()} />
      </dl>

      <HoldingsList rows={rows} editable={editable} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
