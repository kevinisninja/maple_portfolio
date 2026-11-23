#!/usr/bin/env node
/**
 * Convert an extracted item dump (tools/extract_items.py output) into the
 * app's bundled catalog:
 *   data/items.json        compact records for every named, tradeable item
 *                          (untradeable / quest / Cash Shop items are skipped)
 *   public/items/<id>.png  inventory icons (served from the CDN)
 *
 * Usage: node scripts/build-item-data.mjs <path-to-extracted-items-folder>
 * Re-run after a game patch, commit the result, and deploy — the deploy
 * upserts the catalog by game ID.
 */
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, "summary.json"))) {
  console.error("Usage: node scripts/build-item-data.mjs <extracted items folder containing summary.json>");
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const outJson = path.join(root, "data", "items.json");
const outIcons = path.join(root, "public", "items");

const TABS = ["equip", "use", "setup", "etc", "cash", "deco"];

/** Human names for the 4-digit ID groups (dump guide, section 4). */
const GROUPS = {
  "0200": "Potion", "0201": "Food", "0202": "Food & Drink", "0203": "Return Scroll",
  "0204": "Equipment Scroll", "0206": "Arrows", "0207": "Throwing Stars", "0210": "Summoning Sack",
  "0212": "Pet Food", "0219": "Lie Detector", "0221": "Event Item", "0237": "Skill Book",
  "0243": "Box", "0245": "EXP Coupon", "0254": "Hair Coupon", "0289": "Face Coupon",
  "0400": "Monster Drop", "0401": "Ore", "0402": "Jewel Ore", "0403": "Quest Item",
  "0408": "Minigame Set", "0413": "Crafting Catalyst", "0416": "Misc",
  "0501": "Effect", "0503": "Store Skin", "0505": "AP/SP Reset", "0507": "Megaphone",
  "0512": "Weather Effect", "0513": "Safety Charm", "0514": "Store Permit", "0515": "Beauty Coupon",
  "0516": "Emotion", "0517": "Pet Name Tag", "0518": "Water of Life", "0519": "Pet Skill",
  "0522": "Mystery Crate", "0524": "Premium Pet Food", "0545": "Portable Storage",
  "0555": "Beauty Album", "0568": "Slot Coupon", "0578": "Coloring Prism", pet: "Pet",
};

/** Strip MapleStory text markup (see the dump's guide, section 6). */
function cleanText(s) {
  if (s == null) return null;
  const out = String(s)
    .replace(/\r\n?/g, "\n") // real line breaks
    .replace(/(\\+r)?\\+n|\\+r/g, "\n") // escaped "\r\n" / "\n" sequences
    .replace(/�/g, "'")
    .replace(/#[tmopi](\d+)#/g, "") // references to other entities: drop
    .replace(/#[bcdegknr]/g, "")
    .replace(/#/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return out || null;
}

// Stats worth showing in the UI (non-zero values only).
const EQUIP_KEYS = [
  "reqLevel", "reqSTR", "reqDEX", "reqINT", "reqLUK", "reqJob", "tuc",
  "incSTR", "incDEX", "incINT", "incLUK", "incMHP", "incMMP", "incWAT", "incPAD", "incMAD",
  "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump", "attackSpeed",
];
const SCROLL_KEYS = ["success", "cursed", "incSTR", "incDEX", "incINT", "incLUK", "incMHP", "incMMP", "incWAT", "incPAD", "incMAD", "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump"];
const SPEC_KEYS = ["hp", "mp", "hpR", "mpR", "time", "pad", "mad", "pdd", "mdd", "acc", "eva", "speed", "jump"];
const SETUP_KEYS = ["reqLevel", "recoveryHP", "recoveryMP"];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    const v = Number(obj?.[k]);
    if (Number.isFinite(v) && v !== 0) out[k === "incPAD" ? "incWAT" : k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.rmSync(outIcons, { recursive: true, force: true });
fs.mkdirSync(outIcons, { recursive: true });

const items = [];
const counts = {};
let icons = 0;
for (const tab of TABS) {
  const records = JSON.parse(fs.readFileSync(path.join(src, `${tab}.json`), "utf8"));
  for (const r of records) {
    const name = cleanText(r.name);
    if (!name) continue; // unused client leftovers
    const info = r.data?.info ?? {};
    const tradeable = !info.tradeBlock && !info.quest && !info.pquest && !info.cash && tab !== "cash";
    if (!tradeable) continue; // can't be traded between players, so it has no market price

    let stats;
    if (tab === "equip") stats = pick(info, EQUIP_KEYS);
    else if (tab === "use") stats = { ...pick(info, r.group === "0204" ? SCROLL_KEYS : []), ...pick(r.data?.spec, SPEC_KEYS) };
    else if (tab === "setup") stats = pick(info, SETUP_KEYS);
    if (stats && !Object.keys(stats).length) stats = undefined;

    let hasIcon = false;
    if (r.icon) {
      const from = path.join(src, r.icon);
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, path.join(outIcons, `${r.id}.png`));
        hasIcon = true;
        icons++;
      }
    }

    items.push({
      id: r.id,
      name,
      tab,
      category: GROUPS[r.subcategory] ?? GROUPS[r.group] ?? (/^\d{4}$/.test(r.subcategory ?? "") ? "Other" : r.subcategory) ?? r.category ?? null,
      desc: cleanText(r.desc),
      tradeable,
      npcPrice: Number(info.price) || 0,
      icon: hasIcon,
      ...(stats ? { stats } : {}),
    });
    counts[tab] = (counts[tab] ?? 0) + 1;
  }
}
items.sort((a, b) => a.id - b.id);
fs.writeFileSync(outJson, JSON.stringify(items));
const tradeable = items.filter((i) => i.tradeable).length;
console.log(`Wrote ${items.length} items (${tradeable} tradeable) and ${icons} icons`, counts);
