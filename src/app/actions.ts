"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SERVERS } from "@/lib/servers";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getOrCreateProfile, parseAmount, parseItemLines, refreshSnapshots } from "@/lib/portfolio";
import { todayUtc } from "@/lib/dates";
import { ensureFreshPrices, syncCatalogFromProvider } from "@/lib/prices/cache";
import { getProvider } from "@/lib/prices";
import { MOCK_PROVIDER_ID } from "@/lib/prices/mock";
import { backfillMockHistory, clearMockData } from "@/lib/prices/mock-tools";

const { profile, item, holding, itemPrice } = schema;

export type FormState = { ok?: string; error?: string; details?: string[] } | null;

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/u/[username]", "page");
}

/** Map lowercase item names → item rows. */
async function itemsByName(names: string[]) {
  if (names.length === 0) return new Map<string, typeof item.$inferSelect>();
  const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
  const rows = await db
    .select()
    .from(item)
    .where(inArray(sql<string>`lower(${item.name})`, lowered));
  return new Map(rows.map((r) => [r.name.toLowerCase(), r]));
}

/* ───────────── Profile ───────────── */

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3–20 characters: letters, numbers, underscore"),
  server: z.enum(SERVERS),
  isPublic: z.boolean(),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await getOrCreateProfile(user);
  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    server: formData.get("server"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const taken = await db.query.profile.findFirst({ where: eq(profile.username, parsed.data.username) });
  if (taken && taken.userId !== user.id) return { error: "That username is taken" };

  await db.update(profile).set(parsed.data).where(eq(profile.userId, user.id));
  await refreshSnapshots({ userId: user.id });
  revalidateAll();
  return { ok: "Profile saved" };
}

/* ───────────── Holdings ───────────── */

async function upsertHoldings(userId: string, rows: { itemId: number; quantity: number }[], mode: "set" | "add") {
  const toDelete = mode === "set" ? rows.filter((r) => r.quantity <= 0).map((r) => r.itemId) : [];
  const toUpsert = rows.filter((r) => r.quantity > 0);
  if (toDelete.length) {
    await db.delete(holding).where(and(eq(holding.userId, userId), inArray(holding.itemId, toDelete)));
  }
  if (toUpsert.length) {
    await db
      .insert(holding)
      .values(toUpsert.map((r) => ({ userId, itemId: r.itemId, quantity: r.quantity })))
      .onConflictDoUpdate({
        target: [holding.userId, holding.itemId],
        set: {
          quantity: mode === "add" ? sql`${holding.quantity} + excluded.quantity` : sql`excluded.quantity`,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function setHolding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await getOrCreateProfile(user);
  const itemId = Number(formData.get("itemId"));
  const quantity = parseAmount(String(formData.get("quantity") ?? ""));
  const mode = formData.get("mode") === "add" ? "add" : "set";
  if (!Number.isInteger(itemId) || itemId <= 0) return { error: "Pick an item" };
  if (!Number.isFinite(quantity) || quantity < 0) return { error: "Enter a valid quantity" };

  await upsertHoldings(user.id, [{ itemId, quantity: Math.round(quantity) }], mode);
  await refreshSnapshots({ userId: user.id });
  revalidateAll();
  return { ok: quantity === 0 && mode === "set" ? "Removed" : "Saved" };
}

export async function removeHolding(formData: FormData) {
  const user = await requireUser();
  const itemId = Number(formData.get("itemId"));
  if (!Number.isInteger(itemId)) return;
  await db.delete(holding).where(and(eq(holding.userId, user.id), eq(holding.itemId, itemId)));
  await refreshSnapshots({ userId: user.id });
  revalidateAll();
}

export async function importHoldings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await getOrCreateProfile(user);
  const mode = formData.get("mode") === "replace" ? "replace" : "add";
  const { entries, errors } = parseItemLines(String(formData.get("text") ?? ""));
  if (entries.length === 0) return { error: "Nothing to import", details: errors };

  const found = await itemsByName(entries.map((e) => e.name));
  const unknown: string[] = [];
  const merged = new Map<number, number>();
  for (const e of entries) {
    const row = found.get(e.name.toLowerCase());
    if (!row) {
      unknown.push(e.name);
      continue;
    }
    merged.set(row.id, (merged.get(row.id) ?? 0) + e.qty);
  }

  if (mode === "replace") {
    await db.delete(holding).where(eq(holding.userId, user.id));
  }
  const rows = [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
  await upsertHoldings(user.id, rows, mode === "replace" ? "set" : "add");
  await refreshSnapshots({ userId: user.id });
  revalidateAll();

  const details = [
    ...errors,
    ...unknown.map((n) => `Unknown item: "${n}" (ask an admin to add it)`),
  ];
  return { ok: `Imported ${rows.length} item${rows.length === 1 ? "" : "s"}`, details };
}

/* ───────────── Admin: items ───────────── */

export async function createItems(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const lines = String(formData.get("text") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const values = lines.map((l) => {
    const [name, category, iconUrl] = l.split("|").map((p) => p.trim());
    return { name, category: category || null, iconUrl: iconUrl || null };
  }).filter((v) => v.name);
  if (values.length === 0) return { error: "Enter at least one item name" };

  const inserted = await db.insert(item).values(values).onConflictDoNothing().returning({ id: item.id });
  revalidatePath("/admin/prices");
  revalidatePath("/dashboard");
  const skipped = values.length - inserted.length;
  return { ok: `Added ${inserted.length} item(s)${skipped ? `, ${skipped} already existed` : ""}` };
}

export async function deleteItem(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("itemId"));
  if (!Number.isInteger(id)) return;
  await db.delete(item).where(eq(item.id, id));
  await refreshSnapshots();
  revalidatePath("/admin/prices");
  revalidateAll();
}

/* ───────────── Admin: prices ───────────── */

async function writePrices(server: (typeof SERVERS)[number], updatedBy: string, prices: { itemId: number; price: number }[]) {
  // Last entry wins; Postgres rejects an upsert that touches the same row twice.
  const deduped = [...new Map(prices.map((p) => [p.itemId, p])).values()];
  if (deduped.length === 0) return;
  const day = todayUtc();
  await db
    .insert(itemPrice)
    .values(deduped.map((p) => ({ itemId: p.itemId, server, day, price: Math.round(p.price), updatedBy })))
    .onConflictDoUpdate({
      target: [itemPrice.itemId, itemPrice.server, itemPrice.day],
      set: { price: sql`excluded.price`, updatedBy: sql`excluded.updated_by`, updatedAt: sql`now()` },
    });
  await refreshSnapshots({ server });
}

/** Per-item price inputs named `price_<itemId>`; blank inputs are left unchanged. */
export async function savePriceGrid(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const server = z.enum(SERVERS).safeParse(formData.get("server"));
  if (!server.success) return { error: "Unknown server" };

  const prices: { itemId: number; price: number }[] = [];
  const bad: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_")) continue;
    const raw = String(value).trim();
    if (!raw) continue;
    const price = parseAmount(raw);
    if (!Number.isFinite(price) || price < 0) {
      bad.push(`Invalid price "${raw}"`);
      continue;
    }
    prices.push({ itemId: Number(key.slice(6)), price });
  }
  await writePrices(server.data, admin.id, prices);
  revalidatePath("/admin/prices");
  revalidateAll();
  return { ok: `Saved ${prices.length} price(s) for today`, details: bad };
}

/** Bulk paste: "Item name, 1.5m" per line. */
export async function importPrices(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const server = z.enum(SERVERS).safeParse(formData.get("server"));
  if (!server.success) return { error: "Unknown server" };

  const { entries, errors } = parseItemLines(String(formData.get("text") ?? ""));
  const found = await itemsByName(entries.map((e) => e.name));
  const unknown: string[] = [];
  const prices: { itemId: number; price: number }[] = [];
  for (const e of entries) {
    const row = found.get(e.name.toLowerCase());
    if (row) prices.push({ itemId: row.id, price: e.qty });
    else unknown.push(`Unknown item: "${e.name}"`);
  }
  await writePrices(server.data, admin.id, prices);
  revalidatePath("/admin/prices");
  revalidateAll();
  return { ok: `Saved ${prices.length} price(s) for today`, details: [...errors, ...unknown] };
}

/* ───────────── Admin: automated price feed ───────────── */

export async function syncCatalog(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await syncCatalogFromProvider({ createMissing: formData.get("createMissing") === "on" });
    revalidatePath("/admin/prices");
    return {
      ok: `Mapped ${r.matched} item(s)${r.created ? `, created ${r.created}` : ""}`,
      details: r.unmatchedProviderItems ? [`${r.unmatchedProviderItems} provider item(s) have no matching catalog item`] : [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed" };
  }
}

/** Inputs named `ext_<itemId>`; blank inputs are skipped. */
export async function saveExternalIds(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  let saved = 0;
  const errors: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("ext_")) continue;
    const id = Number(key.slice(4));
    const ext = String(value).trim();
    if (!ext) continue;
    try {
      await db.update(item).set({ externalId: ext }).where(eq(item.id, id));
      saved++;
    } catch {
      errors.push(`External ID "${ext}" is already used by another item`);
    }
  }
  revalidatePath("/admin/prices");
  return { ok: `Saved ${saved} mapping(s)`, details: errors };
}

export async function refreshFeedNow(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const server = z.enum(SERVERS).safeParse(formData.get("server"));
  if (!server.success) return { error: "Unknown server" };
  const r = await ensureFreshPrices(server.data, undefined, { force: true, timeoutMs: 20_000 });
  if (!r.provider) return { error: "No price provider is configured" };
  revalidatePath("/admin/prices");
  revalidateAll();
  return { ok: `Fetched ${r.claimed} item(s): ${r.updated} updated, ${r.failed} failed` };
}

/* ───────────── Admin: mock feed tools (testing) ───────────── */

export async function backfillMock(): Promise<FormState> {
  await requireAdmin();
  if (getProvider()?.id !== MOCK_PROVIDER_ID) return { error: "Only available while PRICE_PROVIDER=mock" };
  const r = await backfillMockHistory(90);
  revalidatePath("/admin/prices");
  revalidateAll();
  return { ok: `Generated 90 days of history for ${r.items} item(s)` };
}

export async function clearMock(): Promise<FormState> {
  await requireAdmin();
  const r = await clearMockData();
  revalidatePath("/admin/prices");
  revalidateAll();
  return { ok: `Removed ${r.priceRows} mock price row(s) and past snapshots` };
}
