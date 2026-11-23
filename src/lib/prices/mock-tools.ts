import "server-only";
import { eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { SERVERS } from "@/lib/servers";
import { shiftDay, todayUtc } from "@/lib/dates";
import { refreshSnapshots } from "@/lib/portfolio";
import { MOCK_PROVIDER_ID, mockPriceAt } from "./mock";

/**
 * Testing only: write `days` of past mock prices for every mapped item that
 * someone holds, then
 * rebuild past snapshots from users' *current* holdings, so charts have shape.
 * Never overwrites existing (e.g. manual) price rows.
 */
export async function backfillMockHistory(days = 90) {
  const today = todayUtc();
  // Only items someone holds: the whole catalog would be ~900K rows for nothing.
  const held = await db
    .selectDistinct({ id: schema.item.id, externalId: schema.item.externalId, gameId: schema.item.gameId })
    .from(schema.item)
    .innerJoin(schema.holding, eq(schema.holding.itemId, schema.item.id))
    .where(or(isNotNull(schema.item.externalId), isNotNull(schema.item.gameId)));
  const mapped = held.map((h) => ({ id: h.id, externalId: h.externalId ?? `mock:${h.gameId}` }));

  const rows = [];
  for (const server of SERVERS) {
    for (let d = days; d >= 1; d--) {
      const day = shiftDay(today, -d);
      const at = Date.parse(`${day}T23:45:00Z`);
      for (const m of mapped) {
        rows.push({ itemId: m.id, server, day, price: mockPriceAt(m.externalId, server, at), source: MOCK_PROVIDER_ID });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(schema.itemPrice).values(rows.slice(i, i + 1000)).onConflictDoNothing();
  }
  for (let d = days; d >= 1; d--) await refreshSnapshots({ day: shiftDay(today, -d) });
  await refreshSnapshots();
  return { items: mapped.length, priceRows: rows.length };
}

/** Remove all mock prices and every past snapshot (keeps today's, recomputed). */
export async function clearMockData() {
  const deleted = await db
    .delete(schema.itemPrice)
    .where(eq(schema.itemPrice.source, MOCK_PROVIDER_ID))
    .returning({ id: schema.itemPrice.itemId });
  await db.delete(schema.portfolioSnapshot).where(lt(schema.portfolioSnapshot.day, todayUtc()));
  await db.execute(sql`DELETE FROM price_refresh`);
  await refreshSnapshots();
  return { priceRows: deleted.length };
}
