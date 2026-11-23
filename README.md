# Maple Portfolio

Track the meso value of your MapleStory Classic items over time. Sign in with Google, list what you own, and see your net worth as a daily stock-style chart. Public profiles and a per-server leaderboard (Windia / Zenith).

**Stack:** Next.js 16 (App Router, server actions) · Better Auth (Google sign-in) · Postgres on Neon · Drizzle ORM · Recharts · Tailwind 4 · Vercel Cron

## How it works

| Table | Purpose |
| --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth |
| `profile` | Username, server (Windia default), public/private |
| `item` | Item catalog (managed by admins) |
| `item_price` | Price per item, per server, per UTC day (`source = 'manual'` for now) |
| `holding` | What each user owns |
| `portfolio_snapshot` | Each user's total value per day, which drives the chart and leaderboard |

- **Prices** are entered by admins at `/admin/prices`, one at a time or by pasting `Item name, 45m` lines. An item without a price today uses its most recent earlier price.
- **Snapshots:** a Vercel Cron job (`vercel.json`, 00:05 UTC) creates each day's row for every user. Any holding or price change during the day updates that row, so each day ends with its closing value.
- **Future automated prices:** write rows into `item_price` (with a different `source`) from `src/app/api/cron/snapshot/route.ts` before `refreshSnapshots()` runs.

## Pages

- `/`: landing page and top 10
- `/dashboard`: your holdings, value chart, add/import items, profile settings
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
