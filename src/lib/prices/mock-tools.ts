import "server-only";
import { eq, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { SERVERS } from "@/lib/servers";
import { shiftDay, todayUtc } from "@/lib/dates";
import { refreshSnapshots } from "@/lib/portfolio";
import { MOCK_PROVIDER_ID, mockPriceAt } from "./mock";

/**
 * Testing only: write `days` of past mock prices for every mapped item, then
 * rebuild past snapshots from users' *current* holdings, so charts have shape.
 * Never overwrites existing (e.g. manual) price rows.
 */
export async function backfillMockHistory(days = 90) {
  const today = todayUtc();
  const mapped = await db
    .select({ id: schema.item.id, externalId: schema.item.externalId })
    .from(schema.item)
    .where(isNotNull(schema.item.externalId));

  const rows = [];
  for (const server of SERVERS) {
    for (let d = days; d >= 1; d--) {
      const day = shiftDay(today, -d);
      const at = Date.parse(`${day}T23:45:00Z`);
      for (const m of mapped) {
        rows.push({ itemId: m.id, server, day, price: mockPriceAt(m.externalId!, server, at), source: MOCK_PROVIDER_ID });
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
