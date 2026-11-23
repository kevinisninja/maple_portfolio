#!/usr/bin/env node
/**
 * Upsert the bundled game catalog (data/items.json) into the item table, keyed
 * by game_id. Runs on every deploy after migrations (see "vercel-build").
 *
 * Custom items an admin created earlier (game_id NULL) are adopted when their
 * name matches exactly one game item, so existing holdings and prices carry over.
 * Items that disappear from the data are left alone (holdings may reference them).
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: [".env.local", ".env"], quiet: true });
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.log("[seed-items] DATABASE_URL not set; skipping");
  process.exit(0);
}
const sql = neon(url);
const items = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "items.json"), "utf8"));

const rows = items.map((i) => ({
  game_id: i.id,
  name: i.name,
  tab: i.tab,
  category: i.category,
  description: i.desc,
  icon_url: i.icon ? `/items/${i.id}.png` : null,
  tradeable: i.tradeable,
  npc_price: i.npcPrice,
  stats: i.stats ?? null,
}));

// 1. Adopt pre-existing custom items whose name maps to exactly one game item.
const nameCount = new Map();
for (const r of rows) nameCount.set(r.name.toLowerCase(), (nameCount.get(r.name.toLowerCase()) ?? 0) + 1);
const unique = rows.filter((r) => nameCount.get(r.name.toLowerCase()) === 1).map((r) => ({ game_id: r.game_id, name: r.name }));
const adopted = await sql.query(
  `UPDATE item SET game_id = x.game_id
   FROM jsonb_to_recordset($1::jsonb) AS x(game_id int, name text)
   WHERE item.game_id IS NULL AND lower(item.name) = lower(x.name)
     AND NOT EXISTS (SELECT 1 FROM item i2 WHERE i2.game_id = x.game_id)
   RETURNING item.id`,
  [JSON.stringify(unique)],
);

// 2. Upsert everything by game_id.
let upserted = 0;
for (let i = 0; i < rows.length; i += 1000) {
  const batch = rows.slice(i, i + 1000);
  const res = await sql.query(
    `INSERT INTO item (game_id, name, tab, category, description, icon_url, tradeable, npc_price, stats)
     SELECT game_id, name, tab, category, description, icon_url, tradeable, npc_price, stats
     FROM jsonb_to_recordset($1::jsonb) AS x(game_id int, name text, tab text, category text, description text,
                                             icon_url text, tradeable boolean, npc_price bigint, stats jsonb)
     ON CONFLICT (game_id) DO UPDATE SET
       name = EXCLUDED.name, tab = EXCLUDED.tab, category = EXCLUDED.category,
       description = EXCLUDED.description, icon_url = EXCLUDED.icon_url, tradeable = EXCLUDED.tradeable,
       npc_price = EXCLUDED.npc_price, stats = EXCLUDED.stats
     RETURNING id`,
    [JSON.stringify(batch)],
  );
  upserted += res.length;
}
console.log(`[seed-items] ${upserted} items upserted, ${adopted.length} existing custom item(s) adopted`);
