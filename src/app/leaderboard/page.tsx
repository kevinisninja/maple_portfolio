import Link from "next/link";
import { getLeaderboard } from "@/lib/portfolio";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { DEFAULT_SERVER, SERVERS, SERVER_LABELS, isServer } from "@/lib/servers";

export const metadata = { title: "Leaderboard · Maple Portfolio" };

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const { server: raw } = await props.searchParams;
  const server = isServer(raw) ? raw : DEFAULT_SERVER;
  const rows = await getLeaderboard(server);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
          {SERVERS.map((s) => (
            <Link
              key={s}
              href={`/leaderboard?server=${s}`}
              className={`rounded-md px-3 py-1 text-sm ${s === server ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}
            >
              {SERVER_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>
      <LeaderboardTable rows={rows} />
    </div>
  );
}
