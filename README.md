# CP Contest Portal

One portal for every upcoming competitive-programming contest — Codeforces, LeetCode,
AtCoder & CodeChef — aggregated into a single, always-fresh feed with reminders, calendar
export, and platform auto-follow so you never miss a contest.

## Stack

Next.js 16 (App Router) · TypeScript · tRPC v11 · Prisma 7 + PostgreSQL · Tailwind v4 +
shadcn/ui · Auth.js v5 (Google + GitHub) · Resend (email) · next-themes.

## Local development

```bash
# 1. Start a local Postgres (Docker)
docker compose up -d

# 2. Install deps + generate Prisma client
npm install

# 3. Set up env
cp .env.example .env   # fill in the values (DATABASE_URL is already set for local Docker)

# 4. Migrate + seed
npx prisma migrate dev
npx tsx prisma/seed.ts   # optional: a few sample contests

# 5. Run
npm run dev
```

App runs at http://localhost:3000.

## Syncing contests

Contest data is pulled from each platform (CF API, LeetCode GraphQL, CodeChef API, AtCoder
official-site scrape) by a secret-protected endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

In production this is triggered every 30 min by `.github/workflows/sync.yml`; reminder emails
are dispatched every 15 min by `.github/workflows/reminders.yml`.

## Environment variables

See [`.env.example`](.env.example) for the full list (database, Auth.js, OAuth providers,
Resend, cron secret).

## Deployment

- **DB:** Supabase / Neon (any standard Postgres `DATABASE_URL`).
- **App:** Vercel. Run `npx prisma migrate deploy` against the production DB once.
- **Cron:** GitHub Actions workflows (set repo secrets `APP_URL` and `CRON_SECRET`).
