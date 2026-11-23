import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { searchItems } from "@/lib/catalog";
import { restoreItem } from "@/app/actions";
import { ItemIcon } from "@/components/item-icon";
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
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.server) ? sp.server[0] : sp.server;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const server = isServer(raw) ? raw : DEFAULT_SERVER;
  const today = todayUtc();

  const status = providerStatus();
  const [ids, current, previous, stats] = await Promise.all([
    // The catalog has thousands of items: list the ones in play (held or priced
    // on this server), or search results when a query is given.
    q
      ? searchItems({ q, includeUntradeable: true, limit: 100 }).then((r) => r.items.map((i) => i.id))
      : db
          .execute<{ id: number }>(
            sql`SELECT item_id AS id FROM holding UNION SELECT item_id FROM item_price WHERE server = ${server}`,
          )
          .then((r) => r.rows.map((x) => Number(x.id))),
    latestPrices(server, today),
    latestPrices(server, shiftDay(today, -1)),
    feedStats(server),
  ]);
  const [items, hiddenItems] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(schema.item)
          .where(and(inArray(schema.item.id, ids), eq(schema.item.hidden, false)))
          .orderBy(asc(schema.item.name))
      : [],
    db
      .select({ id: schema.item.id, name: schema.item.name, iconUrl: schema.item.iconUrl })
      .from(schema.item)
      .where(eq(schema.item.hidden, true))
      .orderBy(asc(schema.item.name)),
  ]);
  const provider = getProvider();
  // Only needed when the provider can't derive its IDs from game IDs.
  const unmapped = provider?.externalIdForGameId
    ? items.filter((i) => !i.externalId && i.gameId == null)
    : items.filter((i) => !i.externalId);

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
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-2">
            <h2 className="font-semibold">
              {q ? `Results for “${q}”` : `${SERVER_LABELS[server]} prices · items in play`}
            </h2>
            <form action="/admin/prices" className="flex gap-2">
              <input type="hidden" name="server" value={server} />
              <input name="q" defaultValue={q} className="input w-56 py-1.5" placeholder="Find any item…" aria-label="Find item" />
            </form>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--muted)]">
              {q ? "No items match." : "No items are held or priced yet. Search above to price any item."}
            </p>
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
            {provider?.id === MOCK_PROVIDER_ID && <MockTools />}
            {unmapped.length > 0 && <ExternalIdForm items={unmapped.map((i) => ({ id: i.id, name: i.name }))} />}
          </section>
          {hiddenItems.length > 0 && (
            <section className="card">
              <h2 className="mb-1 font-semibold">Removed items</h2>
              <p className="mb-3 text-xs text-[var(--muted)]">Hidden from the site. Restoring doesn&apos;t bring back old holdings or prices.</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {hiddenItems.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    <ItemIcon src={h.iconUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate">{h.name}</span>
                    <form action={restoreItem}>
                      <input type="hidden" name="itemId" value={h.id} />
                      <button className="text-xs text-[var(--accent)] hover:underline">Restore</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card">
            <h2 className="mb-3 font-semibold">Custom items</h2>
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
