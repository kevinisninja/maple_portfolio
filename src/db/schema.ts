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

/** Catalog of tradeable items (shared across servers). */
export const item = pgTable(
  "item",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"),
    iconUrl: text("icon_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("item_name_lower_idx").on(sql`lower(${t.name})`)],
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
