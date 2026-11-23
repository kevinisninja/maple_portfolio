import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getHistory, getHoldings, getProfileByUsername } from "@/lib/portfolio";
import { PortfolioView } from "@/components/portfolio-view";

export async function generateMetadata(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  return { title: `${username} · Maple Portfolio` };
}

export default async function PublicProfilePage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const viewer = await getSessionUser();
  if (!profile.isPublic && viewer?.id !== profile.userId) notFound();

  const [owner, holdings, history] = await Promise.all([
    db.query.user.findFirst({ where: eq(schema.user.id, profile.userId), columns: { name: true, image: true } }),
    getHoldings(profile.userId, profile.server),
    getHistory(profile.userId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {owner?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.image} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">@{profile.username}</h1>
          {!profile.isPublic && <p className="text-sm text-[var(--muted)]">Private — only you can see this.</p>}
        </div>
      </div>
      <PortfolioView holdings={holdings} history={history} server={profile.server} />
    </div>
  );
}
