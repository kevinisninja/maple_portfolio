import { refreshSnapshots } from "@/lib/portfolio";
import { todayUtc } from "@/lib/dates";

/**
 * Runs daily via Vercel Cron (see vercel.json). Starts each new day's snapshot row
 * for every user, carrying forward the latest known prices. Later the same day,
 * holding/price edits keep that row up to date.
 *
 * When an automated price source exists, fetch and write prices here *before*
 * refreshing snapshots.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await refreshSnapshots();
  return Response.json({ ok: true, day: todayUtc() });
}
