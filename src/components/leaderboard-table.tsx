import Link from "next/link";
import type { LeaderRow } from "@/lib/portfolio";
import { mesos, fullMesos } from "@/lib/format";

export function LeaderboardTable({ rows }: { rows: LeaderRow[] }) {
  if (rows.length === 0) {
    return <p className="card text-sm text-[var(--muted)]">No public portfolios on this server yet.</p>;
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Player</th>
            <th className="num">Items</th>
            <th className="num">Net worth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.username}>
              <td className="tabular-nums text-[var(--muted)]">{i + 1}</td>
              <td>
                <Link href={`/u/${r.username}`} className="flex items-center gap-2 hover:underline">
                  {r.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
                  )}
                  @{r.username}
                </Link>
              </td>
              <td className="num">{Number(r.item_count).toLocaleString()}</td>
              <td className="num font-medium" title={fullMesos(r.total_value)}>{mesos(r.total_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
