import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { latestPrices } from "@/lib/portfolio";
import { todayUtc, shiftDay } from "@/lib/dates";
import { DEFAULT_SERVER, SERVERS, SERVER_LABELS, isServer } from "@/lib/servers";
import { feedStats } from "@/lib/prices/cache";
import { PRICE_TTL_MINUTES, providerStatus } from "@/lib/prices";
import { CreateItemsForm, ExternalIdForm, FeedActions, MockTools, PriceGridForm, PriceImportForm } from "./forms";
import { getProvider } from "@/lib/prices";
import { MOCK_PROVIDER_ID } from "@/lib/prices/mock";

export const maxDuration = 60;

export const metadata = { title: "Prices · Maple Portfolio" };

export default async function AdminPricesPage(props: PageProps<"/admin/prices">) {
  await requireAdmin();
  const { server: raw } = await props.searchParams;
  const server = isServer(raw) ? raw : DEFAULT_SERVER;
  const today = todayUtc();

  const status = providerStatus();
  const [items, current, previous, stats] = await Promise.all([
    db.select().from(schema.item).orderBy(asc(schema.item.name)),
    latestPrices(server, today),
    latestPrices(server, shiftDay(today, -1)),
    feedStats(server),
  ]);
  const unmapped = items.filter((i) => !i.externalId).map((i) => ({ id: i.id, name: i.name }));

  const rows = items.map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    externalId: it.externalId,
    source: current.get(it.id)?.source ?? null,
    price: current.get(it.id)?.price ?? null,
    priceDay: current.get(it.id)?.day ?? null,
    prevPrice: previous.get(it.id)?.price ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Item prices</h1>
          <p className="text-sm text-[var(--muted)]">
            Prices you enter are recorded for today ({today} UTC). Items without a price today carry forward their last
            known price.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
          {SERVERS.map((s) => (
            <Link
              key={s}
              href={`/admin/prices?server=${s}`}
              className={`rounded-md px-3 py-1 text-sm ${s === server ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}
            >
              {SERVER_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card min-w-0 overflow-x-auto p-0">
          <h2 className="px-5 pt-5 pb-2 font-semibold">{SERVER_LABELS[server]} prices</h2>
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--muted)]">Add some items first.</p>
          ) : (
            <PriceGridForm server={server} rows={rows} today={today} />
          )}
        </section>
        <aside className="space-y-6">
          <section className="card space-y-3">
            <h2 className="font-semibold">Price feed</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-[var(--muted)]">Provider</dt>
              <dd>
                {status.label}
                {status.note && <span className="block text-xs text-[var(--muted)]">{status.note}</span>}
              </dd>
              <dt className="text-[var(--muted)]">Cache</dt>
              <dd>{PRICE_TTL_MINUTES} min</dd>
              <dt className="text-[var(--muted)]">Mapped</dt>
              <dd>
                {stats.mapped} of {stats.mapped + stats.unmapped} items
              </dd>
              <dt className="text-[var(--muted)]">Last fetch</dt>
              <dd>{stats.last_success ? new Date(stats.last_success).toLocaleString() : "Never"}</dd>
              <dt className="text-[var(--muted)]">Errors</dt>
              <dd>{stats.erroring}</dd>
            </dl>
            {stats.recentErrors.length > 0 && (
              <ul className="space-y-1 text-xs text-[var(--down)]">
                {stats.recentErrors.map((e) => (
                  <li key={e.name}>
                    {e.name}: {e.error}
                  </li>
                ))}
              </ul>
            )}
            {status.configured && <FeedActions server={server} />}
            {getProvider()?.id === MOCK_PROVIDER_ID && <MockTools />}
            {unmapped.length > 0 && <ExternalIdForm items={unmapped} />}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Add items</h2>
            <CreateItemsForm />
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Bulk paste prices ({SERVER_LABELS[server]})</h2>
            <PriceImportForm server={server} />
          </section>
        </aside>
      </div>
    </div>
  );
}
