import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getLeaderboard } from "@/lib/portfolio";
import { DEFAULT_SERVER, SERVER_LABELS } from "@/lib/servers";
import { SignInButton } from "@/components/sign-in-button";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const top = (await getLeaderboard(DEFAULT_SERVER, 10).catch(() => []));

  return (
    <div className="space-y-12">
      <section className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your MapleStory Classic net worth, tracked daily.</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          List what you own, see what it&apos;s worth in mesos, and watch your portfolio move like a stock chart.
          Share your profile and climb the leaderboard on Windia or Zenith.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <SignInButton />
          <Link href="/leaderboard" className="btn-ghost px-4 py-2">View leaderboard</Link>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Top on {SERVER_LABELS[DEFAULT_SERVER]}</h2>
        <LeaderboardTable rows={top} />
      </section>
    </div>
  );
}
