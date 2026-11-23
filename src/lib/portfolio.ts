import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Server } from "@/lib/servers";
import { todayUtc, shiftDay } from "./dates";
import { ensureFreshPrices } from "./prices/cache";

const { profile, item, holding, portfolioSnapshot } = schema;

/* ───────────── Profiles ───────────── */

function baseUsername(email: string, name: string): string {
  const raw = (email.split("@")[0] || name || "player").toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `player${cleaned}`;
}

export async function getOrCreateProfile(user: { id: string; email: string; name: string }) {
  const existing = await db.query.profile.findFirst({ where: eq(profile.userId, user.id) });
  if (existing) return existing;

  const base = baseUsername(user.email, user.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const [created] = await db
      .insert(profile)
      .values({ userId: user.id, username })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    // Conflict was either on userId (created concurrently) or on username (taken).
    const raced = await db.query.profile.findFirst({ where: eq(profile.userId, user.id) });
    if (raced) return raced;
  }
  throw new Error("Could not allocate a username");
}

export async function getProfileByUsername(username: string) {
  return db.query.profile.findFirst({ where: eq(profile.username, username.toLowerCase()) });
}

/* ───────────── Prices ───────────── */

type PriceRow = { item_id: number; price: number; day: string; source: string };

/** Latest known price per item on or before `day` for a server. */
export async function latestPrices(server: Server, day = todayUtc()): Promise<Map<number, PriceRow>> {
  const res = await db.execute<PriceRow>(sql`
    SELECT DISTINCT ON (item_id) item_id, price::float8 AS price, day::text AS day, source
    FROM item_price
    WHERE server = ${server} AND day <= ${day}
    ORDER BY item_id, day DESC
  `);
  return new Map(res.rows.map((r) => [Number(r.item_id), { ...r, price: Number(r.price) }]));
}

/* ───────────── Holdings ───────────── */

export type HoldingRow = {
  holdingId: number;
  itemId: number;
  name: string;
  category: string | null;
  iconUrl: string | null;
  quantity: number;
  price: number | null;
  priceDay: string | null;
  prevPrice: number | null;
  value: number;
  prevValue: number;
};

export async function getHoldings(userId: string, server: Server): Promise<HoldingRow[]> {
  const today = todayUtc();
  const rows = await db
    .select({
      holdingId: holding.id,
      itemId: item.id,
      name: item.name,
      category: item.category,
      iconUrl: item.iconUrl,
      quantity: holding.quantity,
    })
    .from(holding)
    .innerJoin(item, eq(holding.itemId, item.id))
    .where(eq(holding.userId, userId));

  // Refetch any of these items whose cached price is older than the TTL.
  await ensureFreshPrices(server, rows.map((r) => r.itemId));

  const [current, previous] = await Promise.all([
    latestPrices(server, today),
    latestPrices(server, shiftDay(today, -1)),
  ]);

  return rows
    .map((r) => {
      const cur = current.get(r.itemId);
      const prev = previous.get(r.itemId);
      const price = cur?.price ?? null;
      const prevPrice = prev?.price ?? null;
      return {
        ...r,
        price,
        priceDay: cur?.day ?? null,
        prevPrice,
        value: (price ?? 0) * r.quantity,
        prevValue: (prevPrice ?? price ?? 0) * r.quantity,
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/* ───────────── Snapshots ───────────── */

/**
 * Recompute today's snapshot row(s). Called by the daily cron (to start each new
 * day's row) and whenever holdings or prices change, so each day's row ends up
 * holding that day's closing value.
 */
export async function refreshSnapshots(filter: { userId?: string; server?: Server; day?: string } = {}) {
  const day = filter.day ?? todayUtc();
  const conds = [sql`TRUE`];
  if (filter.userId) conds.push(sql`p.user_id = ${filter.userId}`);
  if (filter.server) conds.push(sql`p.server = ${filter.server}`);

  await db.execute(sql`
    INSERT INTO portfolio_snapshot (user_id, day, server, total_value, item_count)
    SELECT p.user_id, ${day}::date, p.server,
           COALESCE(SUM(h.quantity::numeric * COALESCE(lp.price, 0)), 0)::bigint,
           COALESCE(SUM(h.quantity), 0)::int
    FROM profile p
    LEFT JOIN holding h ON h.user_id = p.user_id
    LEFT JOIN LATERAL (
      SELECT ip.price FROM item_price ip
      WHERE ip.item_id = h.item_id AND ip.server = p.server AND ip.day <= ${day}::date
      ORDER BY ip.day DESC LIMIT 1
    ) lp ON TRUE
    WHERE ${sql.join(conds, sql` AND `)}
    GROUP BY p.user_id, p.server
    ON CONFLICT (user_id, day) DO UPDATE
      SET server = EXCLUDED.server,
          total_value = EXCLUDED.total_value,
          item_count = EXCLUDED.item_count
  `);
}

/** Daily price series per item (oldest first), for sparklines. */
export async function getItemHistories(server: Server, itemIds: number[], days = 30) {
  const out = new Map<number, { day: string; price: number }[]>();
  if (itemIds.length === 0) return out;
  const since = shiftDay(todayUtc(), -days);
  const rows = await db
    .select({ itemId: schema.itemPrice.itemId, day: schema.itemPrice.day, price: schema.itemPrice.price })
    .from(schema.itemPrice)
    .where(
      and(
        eq(schema.itemPrice.server, server),
        inArray(schema.itemPrice.itemId, itemIds),
        sql`${schema.itemPrice.day} >= ${since}`,
      ),
    )
    .orderBy(schema.itemPrice.day);
  for (const r of rows) {
    const list = out.get(r.itemId) ?? [];
    list.push({ day: r.day, price: Number(r.price) });
    out.set(r.itemId, list);
  }
  return out;
}

export async function getHistory(userId: string, days = 3650) {
  const since = shiftDay(todayUtc(), -days);
  return db
    .select({ day: portfolioSnapshot.day, value: portfolioSnapshot.totalValue })
    .from(portfolioSnapshot)
    .where(and(eq(portfolioSnapshot.userId, userId), sql`${portfolioSnapshot.day} >= ${since}`))
    .orderBy(portfolioSnapshot.day);
}

/* ───────────── Leaderboard ───────────── */

export type LeaderRow = {
  username: string;
  name: string;
  image: string | null;
  total_value: number;
  item_count: number;
  day: string;
};

export async function getLeaderboard(server: Server, limit = 100): Promise<LeaderRow[]> {
  const res = await db.execute<LeaderRow>(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (s.user_id)
             p.username, u.name, u.image,
             s.total_value::float8 AS total_value, s.item_count, s.day::text AS day
      FROM portfolio_snapshot s
      JOIN profile p ON p.user_id = s.user_id
      JOIN "user" u ON u.id = s.user_id
      WHERE p.is_public AND p.server = ${server} AND s.server = ${server}
      ORDER BY s.user_id, s.day DESC
    ) latest
    WHERE total_value > 0
    ORDER BY total_value DESC
    LIMIT ${limit}
  `);
  return res.rows.map((r) => ({ ...r, total_value: Number(r.total_value) }));
}

/* ───────────── Import parsing ───────────── */

/**
 * Parse lines like "Chaos Scroll 60%, 12", "12x Chaos Scroll 60%", or
 * "Chaos Scroll 60%\t12". Returns name/qty pairs; bad lines are reported.
 */
export function parseItemLines(text: string): { entries: { name: string; qty: number }[]; errors: string[] } {
  const entries: { name: string; qty: number }[] = [];
  const errors: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let m = line.match(/^(.+?)\s*[,\t:=]\s*([\d,_.]+\s*[kmb]?)$/i) ?? line.match(/^(.+?)\s+x?([\d,_]+)$/i);
    let name: string | undefined;
    let qtyStr: string | undefined;
    if (m) {
      [, name, qtyStr] = m;
    } else if ((m = line.match(/^([\d,_]+)\s*x?\s+(.+)$/i))) {
      [, qtyStr, name] = m;
    }
    const qty = qtyStr ? parseAmount(qtyStr) : NaN;
    if (!name || !Number.isFinite(qty) || qty < 0) {
      errors.push(`Couldn't read: "${line}"`);
      continue;
    }
    entries.push({ name: name.trim(), qty: Math.round(qty) });
  }
  return { entries, errors };
}

/** "1.5b" → 1_500_000_000, "250m" → 250_000_000, "12,000" → 12000 */
export function parseAmount(input: string): number {
  const s = input.trim().toLowerCase().replace(/[,_\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
  if (!m) return NaN;
  const mult = { "": 1, k: 1e3, m: 1e6, b: 1e9 }[m[2] as "" | "k" | "m" | "b"];
  return Number(m[1]) * mult;
}
