import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

export const TABS = ["equip", "use", "setup", "etc", "deco", "cash"] as const;
export type Tab = (typeof TABS)[number];
export const TAB_LABELS: Record<Tab, string> = {
  equip: "Equip",
  use: "Use",
  setup: "Setup",
  etc: "Etc",
  deco: "Deco",
  cash: "Cash",
};

export type CatalogItem = {
  id: number;
  game_id: number | null;
  name: string;
  tab: string | null;
  category: string | null;
  icon_url: string | null;
  tradeable: boolean;
};

/**
 * Search the catalog. Ranks exact name > prefix > word prefix > substring; an
 * all-digits query also matches the game item ID.
 */
export async function searchItems({
  q = "",
  tab,
  category,
  includeUntradeable = false,
  limit = 20,
  offset = 0,
}: {
  q?: string;
  tab?: string;
  category?: string;
  includeUntradeable?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: CatalogItem[]; total: number }> {
  const term = q.trim().toLowerCase();
  const esc = term.replace(/[\\%_]/g, "\\$&"); // escape LIKE wildcards (\ is Postgres' default escape)
  const conds: SQL[] = [];
  if (!includeUntradeable) conds.push(sql`tradeable`);
  if (tab) conds.push(sql`tab = ${tab}`);
  if (category) conds.push(sql`category = ${category}`);
  if (term) {
    const like = `%${esc}%`;
    conds.push(/^\d+$/.test(term) ? sql`(lower(name) LIKE ${like} OR game_id = ${Number(term)})` : sql`lower(name) LIKE ${like}`);
  }
  const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
  // Searching: best match first, shorter names first. Browsing: alphabetical.
  // (Never emit a bare literal like `ORDER BY 0` — Postgres reads it as a column position.)
  const order = term
    ? sql`CASE
        WHEN lower(name) = ${term} OR game_id::text = ${term} THEN 0
        WHEN lower(name) LIKE ${`${esc}%`} THEN 1
        WHEN lower(name) LIKE ${`% ${esc}%`} THEN 2
        ELSE 3 END, length(name), name, id`
    : sql`name, id`;

  const [rows, count] = await Promise.all([
    db.execute<CatalogItem>(sql`
      SELECT id, game_id, name, tab, category, icon_url, tradeable
      FROM item ${where}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM item ${where}`),
  ]);
  return { items: rows.rows, total: Number(count.rows[0]?.n ?? 0) };
}

/** Distinct categories per tab, for filters. */
export async function categoriesByTab(includeUntradeable = false) {
  const res = await db.execute<{ tab: string; category: string; n: number }>(sql`
    SELECT tab, category, count(*)::int AS n FROM item
    WHERE tab IS NOT NULL AND category IS NOT NULL ${includeUntradeable ? sql`` : sql`AND tradeable`}
    GROUP BY tab, category ORDER BY tab, n DESC
  `);
  const out = new Map<string, { category: string; n: number }[]>();
  for (const r of res.rows) {
    const list = out.get(r.tab) ?? [];
    list.push({ category: r.category, n: r.n });
    out.set(r.tab, list);
  }
  return out;
}

/** Readable labels for stats stored on items. */
export const STAT_LABELS: Record<string, string> = {
  reqLevel: "Req. level",
  reqSTR: "Req. STR",
  reqDEX: "Req. DEX",
  reqINT: "Req. INT",
  reqLUK: "Req. LUK",
  reqJob: "Job",
  tuc: "Upgrade slots",
  incSTR: "STR",
  incDEX: "DEX",
  incINT: "INT",
  incLUK: "LUK",
  incMHP: "Max HP",
  incMMP: "Max MP",
  incWAT: "Weapon ATT",
  incMAD: "Magic ATT",
  incPDD: "Weapon DEF",
  incMDD: "Magic DEF",
  incACC: "Accuracy",
  incEVA: "Avoidability",
  incSpeed: "Speed",
  incJump: "Jump",
  attackSpeed: "Attack speed",
  success: "Success rate",
  cursed: "Destroy chance",
  hp: "Restores HP",
  mp: "Restores MP",
  hpR: "Restores HP %",
  mpR: "Restores MP %",
  time: "Duration",
  pad: "Weapon ATT",
  mad: "Magic ATT",
  pdd: "Weapon DEF",
  mdd: "Magic DEF",
  acc: "Accuracy",
  eva: "Avoidability",
  speed: "Speed",
  jump: "Jump",
  recoveryHP: "HP recovery",
  recoveryMP: "MP recovery",
};

const JOBS: [number, string][] = [
  [1, "Warrior"],
  [2, "Magician"],
  [4, "Bowman"],
  [8, "Thief"],
  [16, "Pirate"],
];

export function formatStat(key: string, value: number): string {
  if (key === "reqJob") return JOBS.filter(([bit]) => value & bit).map(([, n]) => n).join(" / ") || "All";
  if (key === "success" || key === "cursed" || key === "hpR" || key === "mpR") return `${value}%`;
  if (key === "time") return value >= 60000 ? `${Math.round(value / 60000)} min` : `${Math.round(value / 1000)} sec`;
  if (key === "attackSpeed") return ["", "", "Fastest", "Faster", "Fast", "Fast", "Normal", "Slow", "Slower", "Slowest"][value] ?? String(value);
  if (key.startsWith("req") || key === "tuc") return String(value);
  return value > 0 ? `+${value}` : String(value);
}
