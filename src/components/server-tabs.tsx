import Link from "next/link";
import { SERVERS, SERVER_LABELS, type Server } from "@/lib/servers";

/** Windia / Zenith switcher that preserves other query params. */
export function ServerTabs({ server, base, params = {} }: { server: Server; base: string; params?: Record<string, string | undefined> }) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
      {SERVERS.map((s) => {
        const qs = new URLSearchParams(Object.entries({ ...params, server: s }).filter(([, v]) => v) as [string, string][]);
        return (
          <Link
            key={s}
            href={`${base}?${qs}`}
            className={`rounded-md px-3 py-1 text-sm ${s === server ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""}`}
          >
            {SERVER_LABELS[s]}
          </Link>
        );
      })}
    </div>
  );
}
