import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  serial,
  date,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { DEFAULT_SERVER, SERVERS, type Server } from "@/lib/servers";

/* ───────────── Better Auth tables (shape required by better-auth) ───────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ───────────── App tables ───────────── */

export { SERVERS, type Server };
export const serverEnum = pgEnum("server", SERVERS);

/** One per user; created lazily the first time they open the dashboard. */
export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  server: serverEnum("server").notNull().default(DEFAULT_SERVER),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Item catalog. Game items are seeded from data/items.json (keyed by game_id);
 * admins can also add custom items (game_id null). Names are NOT unique — the
 * game reuses some — so always key on id/game_id.
 */
export const item = pgTable(
  "item",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").unique(),
    name: text("name").notNull(),
    /** Inventory tab: equip | use | setup | etc | cash | deco */
    tab: text("tab"),
    category: text("category"),
    description: text("description"),
    iconUrl: text("icon_url"),
    /** False for untradeable / quest / cash items; hidden from pickers. */
    tradeable: boolean("tradeable").notNull().default(true),
    /**
     * Removed by an admin. Kept as a tombstone (rather than deleted) so the
     * deploy-time catalog seed doesn't re-add it; the seed never touches this.
     */
    hidden: boolean("hidden").notNull().default(false),
    npcPrice: bigint("npc_price", { mode: "number" }),
    stats: jsonb("stats").$type<Record<string, number>>(),
    /** The price provider's identifier for this item; null = not mapped (manual prices only). */
    externalId: text("external_id").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("item_name_lower_idx").on(sql`lower(${t.name})`), index("item_tab_category_idx").on(t.tab, t.category)],
);

/**
 * Daily price per item per server, in mesos. Entered manually by admins for now;
 * an automated source can write to this same table later. "Current" price is the
 * most recent row on or before a given day.
 */
export const itemPrice = pgTable(
  "item_price",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    server: serverEnum("server").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    source: text("source").notNull().default("manual"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.server, t.day] })],
);

/**
 * Cache bookkeeping for the automated price feed: when each (item, server) was
 * last fetched. A request "claims" stale rows by bumping last_attempt_at, so
 * concurrent requests don't fetch the same item twice.
 */
export const priceRefresh = pgTable(
  "price_refresh",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    server: serverEnum("server").notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.server] })],
);

/** What a user owns. Valued against their profile's server. */
export const holding = pgTable(
  "holding",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("holding_user_item_idx").on(t.userId, t.itemId)],
);

/** End-of-day (or latest-today) total portfolio value — the "stock chart". */
export const portfolioSnapshot = pgTable(
  "portfolio_snapshot",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    server: serverEnum("server").notNull(),
    totalValue: bigint("total_value", { mode: "number" }).notNull(),
    itemCount: integer("item_count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    index("snapshot_day_server_idx").on(t.day, t.server),
  ],
);
