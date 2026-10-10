-- SEO: human-readable contest URLs (/contests/codeforces-round-1105-div-2
-- instead of /contests/<cuid>).
--
-- The column stays NULLABLE permanently, on purpose:
--   * the currently deployed app's INSERTs don't mention it, so the 30-minute
--     sync keeps working while this rolls out;
--   * a row that somehow lands without a slug is self-healed by
--     fillMissingSlugs() on the next sync, and contestPath() falls back to the
--     cuid in the meantime, so a missing slug degrades instead of 500ing.
-- The UNIQUE index is safe from the start: Postgres permits many NULLs in a
-- unique index, and it is what guarantees two contests never share a URL.
ALTER TABLE "Contest" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");
