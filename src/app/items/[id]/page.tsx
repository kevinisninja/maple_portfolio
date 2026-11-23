import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getItemHistories, latestPrices } from "@/lib/portfolio";
import { ensureFreshPrices } from "@/lib/prices/cache";
import { resolveServer } from "@/lib/viewer";
import { formatStat, STAT_LABELS, TAB_LABELS } from "@/lib/catalog";
import { fullMesos, mesos } from "@/lib/format";
import { todayUtc } from "@/lib/dates";
import { SERVER_LABELS } from "@/lib/servers";
import { ItemIcon } from "@/components/item-icon";
import { ServerTabs } from "@/components/server-tabs";
import { PortfolioHero } from "@/components/portfolio-hero";
import { AddHoldingForm } from "@/components/holding-forms";
import { RemoveItemButton } from "@/components/remove-item-button";
import { isAdmin } from "@/lib/auth";
import { restoreItem } from "@/app/actions";

async function loadItem(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.query.item.findFirst({ where: eq(schema.item.id, id) }) ?? null;
}

export async function generateMetadata(props: PageProps<"/items/[id]">) {
  const it = await loadItem((await props.params).id);
  return { title: it ? `${it.name} · Maple Portfolio` : "Item not found" };
}

export default async function ItemPage(props: PageProps<"/items/[id]">) {
  const it = await loadItem((await props.params).id);
  if (!it) notFound();
  const sp = await props.searchParams;
  const serverParam = Array.isArray(sp.server) ? sp.server[0] : sp.server;
  const { server, user } = await resolveServer(serverParam);
  const admin = isAdmin(user);
  if (it.hidden && !admin) notFound();

  await ensureFreshPrices(server, [it.id]);
  const today = todayUtc();
  const [prices, histories, held, holderCount] = await Promise.all([
    latestPrices(server, today),
    getItemHistories(server, [it.id], 3650),
    user
      ? db.query.holding.findFirst({ where: and(eq(schema.holding.userId, user.id), eq(schema.holding.itemId, it.id)) })
      : null,
    admin ? db.$count(schema.holding, eq(schema.holding.itemId, it.id)) : 0,
  ]);
  const current = prices.get(it.id);
  const history = (histories.get(it.id) ?? []).map((p) => ({ day: p.day, value: p.price }));
  // jsonb doesn't preserve key order, so present stats in STAT_LABELS order (requirements first).
  const statOrder = Object.keys(STAT_LABELS);
  const stats = Object.entries(it.stats ?? {})
    .filter(([k]) => STAT_LABELS[k])
    .sort(([a], [b]) => statOrder.indexOf(a) - statOrder.indexOf(b));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <ItemIcon src={it.iconUrl} size={64} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{it.name}</h1>
              <p className="text-sm text-[var(--muted)]">
                {[it.tab && TAB_LABELS[it.tab as keyof typeof TAB_LABELS], it.category]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {!it.tradeable && (
                <span className="mt-1 inline-block rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  Untradeable
                </span>
              )}
            </div>
          </div>
          <ServerTabs server={server} base={`/items/${it.id}`} />
        </div>

        {current ? (
          <PortfolioHero
            history={history}
            liveTotal={current.price}
            today={today}
            title={`Price · ${SERVER_LABELS[server]}`}
            emptyText="Price history appears here after a second day of prices."
          />
        ) : (
          <div className="card text-sm text-[var(--muted)]">No price on {SERVER_LABELS[server]} yet.</div>
        )}

        {(stats.length > 0 || it.description || it.npcPrice) && (
          <section className="grid gap-8 sm:grid-cols-2">
            {stats.length > 0 && (
              <div>
                <h2 className="mb-2 font-semibold">Stats</h2>
                <dl className="divide-y divide-[var(--border)] text-sm">
                  {stats.map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5">
                      <dt className="text-[var(--muted)]">{STAT_LABELS[k]}</dt>
                      <dd className="tabular-nums">{formatStat(k, v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="space-y-4">
              {it.description && (
                <div>
                  <h2 className="mb-2 font-semibold">Description</h2>
                  <p className="text-sm whitespace-pre-line text-[var(--muted)]">{it.description}</p>
                </div>
              )}
              {it.npcPrice ? (
                <div className="flex justify-between border-t border-[var(--border)] pt-3 text-sm">
                  <span className="text-[var(--muted)]">NPC sell price</span>
                  <span className="tabular-nums">{it.npcPrice.toLocaleString()} mesos</span>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        {it.hidden && (
          <section className="card space-y-3 border-[var(--down)]">
            <p className="text-sm">This item has been removed from the site. Only admins can see this page.</p>
            <form action={restoreItem}>
              <input type="hidden" name="itemId" value={it.id} />
              <button className="btn-primary w-full">Restore item</button>
            </form>
          </section>
        )}
        {held && current && (
          <section className="card space-y-1">
            <h2 className="font-semibold">Your position</h2>
            <div className="text-2xl font-semibold" title={fullMesos(held.quantity * current.price)}>
              {mesos(held.quantity * current.price)}
            </div>
            <div className="text-sm text-[var(--muted)]">
              {held.quantity.toLocaleString()} × {mesos(current.price)}
            </div>
          </section>
        )}
        {user ? (
          it.tradeable &&
          !it.hidden && (
            <section className="card">
              <h2 className="mb-3 font-semibold">Add to portfolio</h2>
              <AddHoldingForm
                initial={{ id: it.id, gameId: it.gameId, name: it.name, category: it.category, iconUrl: it.iconUrl }}
              />
            </section>
          )
        ) : (
          <p className="card text-sm text-[var(--muted)]">Sign in to add this to your portfolio.</p>
        )}
        {admin && !it.hidden && (
          <section className="card space-y-2">
            <h2 className="font-semibold">Admin</h2>
            <p className="text-xs text-[var(--muted)]">
              Removing hides it from search and pickers and takes it out of every portfolio.
            </p>
            <RemoveItemButton itemId={it.id} name={it.name} holders={holderCount} />
          </section>
        )}
        <Link href="/items" className="block text-center text-sm text-[var(--accent)] hover:underline">
          ← All items
        </Link>
      </aside>
    </div>
  );
}
