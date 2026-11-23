import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { latestPrices } from "@/lib/portfolio";
import { todayUtc, shiftDay } from "@/lib/dates";
import { DEFAULT_SERVER, SERVERS, SERVER_LABELS, isServer } from "@/lib/servers";
import { CreateItemsForm, PriceGridForm, PriceImportForm } from "./forms";

export const metadata = { title: "Prices · Maple Portfolio" };

export default async function AdminPricesPage(props: PageProps<"/admin/prices">) {
  await requireAdmin();
  const { server: raw } = await props.searchParams;
  const server = isServer(raw) ? raw : DEFAULT_SERVER;
  const today = todayUtc();

  const [items, current, previous] = await Promise.all([
    db.select().from(schema.item).orderBy(asc(schema.item.name)),
    latestPrices(server, today),
    latestPrices(server, shiftDay(today, -1)),
  ]);

  const rows = items.map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    price: current.get(it.id)?.price ?? null,
    priceDay: current.get(it.id)?.day ?? null,
    prevPrice: previous.get(it.id)?.price ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Item prices</h1>
          <p className="text-sm text-[var(--muted)]">
            Prices you enter are recorded for today ({today} UTC). Items without a price today carry forward their last
            known price.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
          {SERVERS.map((s) => (
            <Link
              key={s}
              href={`/admin/prices?server=${s}`}
              className={`rounded-md px-3 py-1 text-sm ${s === server ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}
            >
              {SERVER_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card min-w-0 overflow-x-auto p-0">
          <h2 className="px-5 pt-5 pb-2 font-semibold">{SERVER_LABELS[server]} prices</h2>
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--muted)]">Add some items first.</p>
          ) : (
            <PriceGridForm server={server} rows={rows} today={today} />
          )}
        </section>
        <aside className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold">Add items</h2>
            <CreateItemsForm />
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Bulk paste prices ({SERVER_LABELS[server]})</h2>
            <PriceImportForm server={server} />
          </section>
        </aside>
      </div>
    </div>
  );
}
