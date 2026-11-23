# Maple Portfolio

Track the meso value of your MapleStory Classic items over time. Sign in with Google, list what you own, and see your net worth as a daily stock-style chart. Public profiles and a per-server leaderboard (Windia / Zenith).

**Stack:** Next.js 16 (App Router, server actions) · Better Auth (Google sign-in) · Postgres on Neon · Drizzle ORM · Recharts · Tailwind 4 · Vercel Cron

## How it works

| Table | Purpose |
| --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth |
| `profile` | Username, server (Windia default), public/private |
| `item` | Item catalog: game items keyed by `game_id` (seeded from `data/items.json`), plus optional custom items |
| `item_price` | Price per item, per server, per UTC day; `source` is `manual` or the provider ID |
| `holding` | What each user owns |
| `price_refresh` | Feed cache bookkeeping: last fetch attempt, success and error per item and server |
| `portfolio_snapshot` | Each user's total value per day, which drives the chart and leaderboard |

- **Prices** come from two places, both stored in `item_price` (one row per item, server and UTC day):
  - **Manual:** admins enter them at `/admin/prices`, one at a time or by pasting `Item name, 45m` lines.
  - **Automated feed** (optional): when `PRICE_PROVIDER` is set, prices are cached for 15 minutes. Viewing a portfolio checks its items, and any item fetched more than 15 minutes ago is refetched from the provider (5-second budget; on failure the last known price is shown). Each stale item is claimed atomically in `price_refresh`, so concurrent requests fetch it only once. A failed item is retried after 1 minute.
  - An item without a price today uses its most recent earlier price.
- **Snapshots:** a Vercel Cron job (`vercel.json`, 00:05 UTC) force-refreshes the feed, then creates each day's row for every user. Holding and price changes during the day update that row, so each day ends with its closing value.

### Price providers

The code is in `src/lib/prices/`. A provider implements `PriceProvider` (`types.ts`): `fetchPrices(server, externalIds)` and, optionally, `listItems()`. Catalog items link to provider items through `item.external_id`. Set it on the Prices page, or click **Map catalog to provider by name**. Unmapped items keep manual prices.

| `PRICE_PROVIDER` | Behavior |
| --- | --- |
| *(unset)* | Manual prices only |
| `mock` | Fake prices that drift every 15 minutes, for testing the cache |
| `mesos.watch` | Real feed. **Stub:** fill in the TODOs in `mesos-watch.ts`, set `IMPLEMENTED = true`, and add `MESOS_WATCH_API_KEY` |

## Item catalog

The catalog comes from the game client's datamined item dump (`tools/extract_items.py` output, kept out of git):

```sh
npm run items:build -- <path-to-extracted-items-folder>   # writes data/items.json + public/items/<id>.png
```

Commit the result. Every deploy runs `scripts/seed-items.mjs` after migrations, which upserts every item by `game_id`; re-running it is safe. Only tradeable items are bundled; untradeable, quest and Cash Shop items are skipped. Admins can **remove** an item from its item page: game items become `hidden` (the seed never un-hides them, so they stay removed across deploys) and leave every portfolio. Custom items are deleted. Restore removed items from the Prices page. Item names are **not** unique (the game reuses some), so code keys on `id` or `game_id`. Imports accept a game ID in place of a name.

## Pages

- `/`: landing page and top 10
- `/dashboard`: your holdings, value chart, add/import items, profile settings
- `/items` and `/items/<id>`: catalog search and browse, item detail with price history and stats
- `/u/<username>`: public profile
- `/leaderboard?server=windia|zenith`
- `/admin/prices`: add items, set daily prices (only for emails in `ADMIN_EMAILS`)

## Setup

1. **Database:** in Vercel, open Project → Storage → Create → Neon Postgres. That sets `DATABASE_URL`. For local dev, copy it into `.env`.
2. **Google OAuth:** in Google Cloud Console, open APIs & Services → Credentials → OAuth client ID (Web application).
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-domain>/api/auth/callback/google`
3. **Env vars:** `cp .env.example .env` and fill it in. Add the same values in Vercel → Settings → Environment Variables, with `BETTER_AUTH_URL` set to your production URL.
   ```sh
   openssl rand -base64 32   # BETTER_AUTH_SECRET
   openssl rand -hex 24      # CRON_SECRET
   ```
4. **Migrate and run:**
   ```sh
   npm install
   npm run db:migrate
   npm run dev
   ```
5. Sign in with an email listed in `ADMIN_EMAILS`, go to **Prices**, add items, and set prices.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:generate`: create a migration after editing `src/db/schema.ts`
- `npm run db:migrate`: apply migrations
- `npm run db:studio`: browse the database
- `npm run typecheck`
