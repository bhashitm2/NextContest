-- Security fix: enable Row-Level Security on every table in the public schema.
--
-- Why: Supabase auto-exposes a PostgREST Data API over the public schema, gated
-- ONLY by RLS. With RLS off, anyone with the anon key + project URL could read/
-- write all tables (incl. Account OAuth tokens + User emails). This app never
-- uses the Data API (Prisma over the direct Postgres connection only), so we add
-- NO policies — the anon/authenticated API roles get zero access, fully closing
-- the hole. The `postgres` role (rolbypassrls = true AND owner of every table)
-- keeps full access, so Prisma is unaffected. RLS is NOT forced, so ownership
-- bypass also holds.

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarTombstone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComparisonVerdict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContestResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformHandle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
