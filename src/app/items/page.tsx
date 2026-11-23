import Link from "next/link";
import { searchItems, categoriesByTab, TABS, TAB_LABELS } from "@/lib/catalog";
import { latestPrices } from "@/lib/portfolio";
import { resolveServer } from "@/lib/viewer";
import { mesos } from "@/lib/format";
import { SERVER_LABELS } from "@/lib/servers";
import { ItemIcon } from "@/components/item-icon";
import { ServerTabs } from "@/components/server-tabs";

export const metadata = { title: "Items · Maple Portfolio" };

const PAGE_SIZE = 60;

export default async function ItemsPage(props: PageProps<"/items">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(sp.q) ?? "";
  const tab = TABS.includes(one(sp.tab) as never) ? one(sp.tab) : undefined;
  const category = one(sp.category) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { server } = await resolveServer(one(sp.server));

  const [{ items, total }, cats, prices] = await Promise.all([
    searchItems({ q, tab, category, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    categoriesByTab(),
    latestPrices(server),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: Record<string, string | number | undefined>) => {
    const merged = { q: q || undefined, tab, category, server: one(sp.server), page: undefined, ...over };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]));
    const s = qs.toString();
    return s ? `/items?${s}` : "/items";
  };
  const tabCats = tab ? cats.get(tab) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-sm text-[var(--muted)]">
            {total.toLocaleString()} tradeable item{total === 1 ? "" : "s"} · prices on {SERVER_LABELS[server]}
          </p>
        </div>
        <ServerTabs server={server} base="/items" params={{ q: q || undefined, tab, category }} />
      </div>

      <form action="/items" className="flex gap-2">
        {tab && <input type="hidden" name="tab" value={tab} />}
        {category && <input type="hidden" name="category" value={category} />}
        {one(sp.server) && <input type="hidden" name="server" value={one(sp.server)} />}
        <input name="q" defaultValue={q} className="input" placeholder="Search items…" aria-label="Search items" />
        <button className="btn-primary">Search</button>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Inventory tab">
        <Chip href={href({ tab: undefined, category: undefined })} active={!tab}>
          All
        </Chip>
        {TABS.filter((t) => cats.has(t)).map((t) => (
          <Chip key={t} href={href({ tab: t, category: undefined })} active={tab === t}>
            {TAB_LABELS[t]}
          </Chip>
        ))}
      </nav>
      {tabCats.length > 1 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Category">
          <Chip small href={href({ category: undefined })} active={!category}>
            All {TAB_LABELS[tab as keyof typeof TAB_LABELS]}
          </Chip>
          {tabCats.map((c) => (
            <Chip small key={c.category} href={href({ category: c.category })} active={category === c.category}>
              {c.category} <span className="text-[var(--muted)]">{c.n}</span>
            </Chip>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <p className="card text-sm text-[var(--muted)]">No items match.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const p = prices.get(it.id);
            return (
              <li key={it.id}>
                <Link
                  href={`/items/${it.id}${one(sp.server) ? `?server=${one(sp.server)}` : ""}`}
                  className="card flex items-center gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--background)]">
                    <ItemIcon src={it.icon_url} size={32} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{it.name}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {it.category}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                    {p ? mesos(p.price) : <span className="text-[var(--muted)]">—</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="btn-ghost" href={href({ page: page - 1 })}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--muted)]">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link className="btn-ghost" href={href({ page: page + 1 })}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, small, children }: { href: string; active: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border ${small ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"} ${
        active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] hover:border-[var(--foreground)]"
      }`}
    >
      {children}
    </Link>
  );
}
