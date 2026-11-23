import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getHistory, getHoldings, getItemHistories, getOrCreateProfile } from "@/lib/portfolio";
import { PortfolioView } from "@/components/portfolio-view";
import { AddHoldingForm, ImportForm, ProfileForm } from "@/components/holding-forms";

export const metadata = { title: "My portfolio · Maple Portfolio" };

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getOrCreateProfile(user);
  const [holdings, history, items] = await Promise.all([
    getHoldings(user.id, profile.server),
    getHistory(user.id),
    db.select({ id: schema.item.id, name: schema.item.name }).from(schema.item).orderBy(asc(schema.item.name)),
  ]);
  const sparks = await getItemHistories(profile.server, holdings.map((h) => h.itemId));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {profile.isPublic && (
          <div className="flex justify-end">
            <Link href={`/u/${profile.username}`} className="text-sm text-[var(--accent)] hover:underline">
              View public profile →
            </Link>
          </div>
        )}
        <PortfolioView holdings={holdings} history={history} sparks={sparks} server={profile.server} editable />
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className="card">
          <h2 className="mb-3 font-semibold">Add an item</h2>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No items in the catalog yet. An admin needs to add some.</p>
          ) : (
            <AddHoldingForm items={items} />
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Bulk import</h2>
          <ImportForm />
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Profile</h2>
          <ProfileForm username={profile.username} server={profile.server} isPublic={profile.isPublic} />
        </section>
      </aside>
    </div>
  );
}
