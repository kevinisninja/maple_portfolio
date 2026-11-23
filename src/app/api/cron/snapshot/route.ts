import { db, schema } from "@/db";
import { refreshSnapshots } from "@/lib/portfolio";
import { ensureFreshPrices } from "@/lib/prices/cache";
import { todayUtc } from "@/lib/dates";
import { SERVERS } from "@/lib/servers";

export const maxDuration = 60;

/**
 * Runs daily via Vercel Cron (see vercel.json). Starts each new day's snapshot row
 * for every user, carrying forward the latest known prices. Later the same day,
 * holding/price edits keep that row up to date.
 *
 * If a price provider is configured, every held item is refreshed first so
 * each day starts from a fresh price.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Only items someone holds: that's what snapshots need, and it keeps API usage down.
  const held = (await db.selectDistinct({ id: schema.holding.itemId }).from(schema.holding)).map((h) => h.id);
  const prices = await Promise.all(SERVERS.map((s) => ensureFreshPrices(s, held, { force: true, timeoutMs: 45_000 })));
  await refreshSnapshots();
  return Response.json({ ok: true, day: todayUtc(), prices: Object.fromEntries(SERVERS.map((s, i) => [s, prices[i]])) });
}
