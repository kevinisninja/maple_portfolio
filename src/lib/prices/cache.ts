import "server-only";
import { after } from "next/server";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Server } from "@/lib/servers";
import { todayUtc } from "@/lib/dates";
import { refreshSnapshots } from "@/lib/portfolio";
import {
  getProvider,
  PRICE_FETCH_TIMEOUT_MS,
  PRICE_RETRY_MINUTES,
  PRICE_TTL_MINUTES,
  type PriceProvider,
} from "./index";

const { item, itemPrice, priceRefresh } = schema;

export type RefreshResult = { provider: string | null; claimed: number; updated: number; failed: number };

function intArray(ids: number[]) {
  return sql`ARRAY[${sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `,
  )}]::int[]`;
}

/**
 * Make sure prices for these items are at most PRICE_TTL_MINUTES old, fetching
 * stale ones from the provider. Never throws: on failure the cached (older)
 * prices simply stay in place.
 *
 * Dedup: each stale (item, server) is "claimed" by atomically bumping
 * last_attempt_at, so concurrent requests fetch each item at most once.
 *
 * @param itemIds items to check; omit to check every mapped item (cron).
 * @param force     ignore the TTL (still deduped against fetches in the last minute).
 * @param timeoutMs total budget for provider calls; pages keep this short.
 */
export async function ensureFreshPrices(
  server: Server,
  itemIds?: number[],
  { force = false, timeoutMs = PRICE_FETCH_TIMEOUT_MS }: { force?: boolean; timeoutMs?: number } = {},
): Promise<RefreshResult> {
  const provider = getProvider();
  const result: RefreshResult = { provider: provider?.id ?? null, claimed: 0, updated: 0, failed: 0 };
  if (!provider || itemIds?.length === 0) return result;

  try {
    const mapped = await db
      .select({ id: item.id, externalId: item.externalId })
      .from(item)
      .where(itemIds ? and(isNotNull(item.externalId), inArray(item.id, itemIds)) : isNotNull(item.externalId));
    if (mapped.length === 0) return result;

    const ttl = force ? "1 minute" : `${PRICE_TTL_MINUTES} minutes`;
    const claimed = await db.execute<{ item_id: number }>(sql`
      INSERT INTO price_refresh (item_id, server, last_attempt_at)
      SELECT id, ${server}::server, now() FROM unnest(${intArray(mapped.map((m) => m.id))}) AS id
      ON CONFLICT (item_id, server) DO UPDATE SET last_attempt_at = now()
        WHERE price_refresh.last_attempt_at < now() - ${ttl}::interval
      RETURNING item_id
    `);
    const claimedIds = new Set(claimed.rows.map((r) => Number(r.item_id)));
    const toFetch = mapped.filter((m) => claimedIds.has(m.id)) as { id: number; externalId: string }[];
    result.claimed = toFetch.length;
    if (toFetch.length === 0) return result;

    const signal = AbortSignal.timeout(timeoutMs);
    for (let i = 0; i < toFetch.length; i += provider.maxBatchSize) {
      const batch = toFetch.slice(i, i + provider.maxBatchSize);
      const outcome = await fetchBatch(provider, server, batch, signal);
      result.updated += outcome.updated;
      result.failed += outcome.failed;
    }

    if (result.updated > 0) {
      // Snapshot totals for everyone on this server; don't make the viewer wait.
      after(() => refreshSnapshots({ server }).catch((e) => console.error("[prices] snapshot refresh failed", e)));
    }
  } catch (err) {
    console.error("[prices] ensureFreshPrices failed", err);
  }
  return result;
}

async function fetchBatch(
  provider: PriceProvider,
  server: Server,
  batch: { id: number; externalId: string }[],
  signal: AbortSignal,
): Promise<{ updated: number; failed: number }> {
  let prices: Map<string, number>;
  try {
    prices = await provider.fetchPrices(server, batch.map((b) => b.externalId), signal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[prices] ${provider.id} fetch failed for ${batch.length} item(s): ${msg}`);
    await markFailed(server, batch.map((b) => b.id), msg);
    return { updated: 0, failed: batch.length };
  }

  const ok: { itemId: number; price: number }[] = [];
  const missing: number[] = [];
  for (const b of batch) {
    const p = prices.get(b.externalId);
    if (p != null && Number.isFinite(p) && p >= 0) ok.push({ itemId: b.id, price: Math.round(p) });
    else missing.push(b.id);
  }

  if (ok.length) {
    const day = todayUtc();
    await db
      .insert(itemPrice)
      .values(ok.map((o) => ({ itemId: o.itemId, server, day, price: o.price, source: provider.id })))
      .onConflictDoUpdate({
        target: [itemPrice.itemId, itemPrice.server, itemPrice.day],
        set: { price: sql`excluded.price`, source: sql`excluded.source`, updatedBy: null, updatedAt: sql`now()` },
      });
    await db
      .update(priceRefresh)
      .set({ lastSuccessAt: sql`now()`, lastError: null })
      .where(and(eq(priceRefresh.server, server), inArray(priceRefresh.itemId, ok.map((o) => o.itemId))));
  }
  if (missing.length) await markFailed(server, missing, `Not returned by ${provider.id}`);
  return { updated: ok.length, failed: missing.length };
}

/** Back-date the attempt so the item becomes eligible again after PRICE_RETRY_MINUTES. */
async function markFailed(server: Server, itemIds: number[], error: string) {
  await db
    .update(priceRefresh)
    .set({
      lastAttemptAt: sql`now() - ${`${PRICE_TTL_MINUTES - PRICE_RETRY_MINUTES} minutes`}::interval`,
      lastError: error.slice(0, 500),
    })
    .where(and(eq(priceRefresh.server, server), inArray(priceRefresh.itemId, itemIds)));
}

/* ───────────── Catalog mapping ───────────── */

export type SyncResult = { matched: number; created: number; unmatchedProviderItems: number };

/**
 * Pull the provider's item list and set external_id on catalog items whose name
 * matches (case-insensitive). Optionally create catalog items for the rest.
 */
export async function syncCatalogFromProvider({ createMissing = false } = {}): Promise<SyncResult> {
  const provider = getProvider();
  if (!provider?.listItems) throw new Error("The active price provider doesn't support listing items");
  const providerItems = await provider.listItems(AbortSignal.timeout(20_000));

  const unmapped = await db.select({ id: item.id, name: item.name }).from(item).where(isNull(item.externalId));
  const byName = new Map(unmapped.map((u) => [u.name.toLowerCase(), u.id]));
  const taken = new Set(
    (await db.select({ e: item.externalId }).from(item).where(isNotNull(item.externalId))).map((r) => r.e),
  );

  let matched = 0;
  const leftovers = [];
  for (const p of providerItems) {
    if (taken.has(p.externalId)) continue;
    const id = byName.get(p.name.toLowerCase());
    if (id != null) {
      await db.update(item).set({ externalId: p.externalId }).where(eq(item.id, id));
      byName.delete(p.name.toLowerCase());
      taken.add(p.externalId);
      matched++;
    } else {
      leftovers.push(p);
    }
  }

  let created = 0;
  if (createMissing && leftovers.length) {
    const inserted = await db
      .insert(item)
      .values(leftovers.map((p) => ({ name: p.name, category: p.category ?? null, iconUrl: p.iconUrl ?? null, externalId: p.externalId })))
      .onConflictDoNothing()
      .returning({ id: item.id });
    created = inserted.length;
  }
  return { matched, created, unmatchedProviderItems: leftovers.length - created };
}

/* ───────────── Admin stats ───────────── */

export async function feedStats(server: Server) {
  const res = await db.execute<{
    mapped: number;
    unmapped: number;
    last_success: string | null;
    erroring: number;
  }>(sql`
    SELECT
      (SELECT count(*) FROM item WHERE external_id IS NOT NULL)::int AS mapped,
      (SELECT count(*) FROM item WHERE external_id IS NULL)::int AS unmapped,
      (SELECT max(last_success_at)::text FROM price_refresh WHERE server = ${server}) AS last_success,
      (SELECT count(*) FROM price_refresh WHERE server = ${server} AND last_error IS NOT NULL)::int AS erroring
  `);
  const recentErrors = await db
    .select({ name: item.name, error: priceRefresh.lastError, at: priceRefresh.lastAttemptAt })
    .from(priceRefresh)
    .innerJoin(item, eq(item.id, priceRefresh.itemId))
    .where(and(eq(priceRefresh.server, server), isNotNull(priceRefresh.lastError)))
    .limit(10);
  return { ...res.rows[0], recentErrors };
}
