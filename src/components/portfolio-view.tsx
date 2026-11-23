import type { HoldingRow } from "@/lib/portfolio";
import type { Server } from "@/lib/servers";
import { mesos, fullMesos, SERVER_LABELS } from "@/lib/format";
import { Change } from "./change";
import { ValueChart } from "./value-chart";
import { QuantityCell } from "./holding-forms";

export function PortfolioView({
  holdings,
  history,
  server,
  editable = false,
}: {
  holdings: HoldingRow[];
  history: { day: string; value: number }[];
  server: Server;
  editable?: boolean;
}) {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const prevTotal = holdings.reduce((s, h) => s + h.prevValue, 0);
  const unpriced = holdings.filter((h) => h.price == null).length;
  const best = history.reduce((m, h) => Math.max(m, h.value), total);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net worth" value={mesos(total)} title={fullMesos(total)} />
        <Stat label="24h change" value={<Change cur={total} prev={prevTotal} />} />
        <Stat label="All-time high" value={mesos(best)} title={fullMesos(best)} />
        <Stat label="Server" value={SERVER_LABELS[server]} sub={`${holdings.length} item types`} />
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Value over time</h2>
        <ValueChart data={history} />
      </section>

      <section className="card overflow-x-auto p-0">
        <div className="flex items-baseline justify-between px-5 pt-5 pb-2">
          <h2 className="font-semibold">Holdings</h2>
          {unpriced > 0 && (
            <span className="text-xs text-[var(--muted)]">{unpriced} item(s) have no price yet</span>
          )}
        </div>
        {holdings.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-[var(--muted)]">No items yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Value</th>
                <th className="num">24h</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.itemId}>
                  <td>
                    <div className="flex items-center gap-2">
                      {h.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.iconUrl} alt="" className="h-6 w-6 object-contain" />
                      )}
                      <div>
                        <div className="font-medium">{h.name}</div>
                        {h.category && <div className="text-xs text-[var(--muted)]">{h.category}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    {editable ? <QuantityCell itemId={h.itemId} quantity={h.quantity} /> : h.quantity.toLocaleString()}
                  </td>
                  <td className="num" title={h.priceDay ? `as of ${h.priceDay}` : undefined}>
                    {mesos(h.price)}
                  </td>
                  <td className="num font-medium" title={fullMesos(h.value)}>
                    {mesos(h.value)}
                  </td>
                  <td className="num">
                    <Change cur={h.value} prev={h.prevValue} showAbs={false} />
                  </td>
                  <td className="num text-[var(--muted)]">{total ? ((h.value / total) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, title }: { label: string; value: React.ReactNode; sub?: string; title?: string }) {
  return (
    <div className="card" title={title}>
      <div className="label">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
