import { ContestStatus, type Platform } from "@/generated/prisma/client";
import { slugCandidates } from "@/lib/contest-slug";
import { prisma } from "@/lib/db";

import { fetchAtCoder } from "./atcoder";
import { syncAllAutoBookmarks } from "./auto-bookmarks";
import { fetchCodeChef } from "./codechef";
import { fetchCodeforces } from "./codeforces";
import { fetchLeetCode } from "./leetcode";
import { type NormalizedContest } from "./types";

export type SyncResult = {
  source: Platform;
  ok: boolean;
  count?: number;
  error?: string;
};

function statusFor(startTime: Date, endTime: Date): ContestStatus {
  const now = Date.now();
  if (endTime.getTime() < now) return ContestStatus.FINISHED;
  if (startTime.getTime() <= now) return ContestStatus.ONGOING;
  return ContestStatus.UPCOMING;
}

/** Postgres unique-violation surfaced by Prisma — here, a slug already taken. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Write a contest, managing its `slug` (the public URL segment).
 *
 * Slugs are derived from the title, and titles DO change: Codeforces publishes
 * rounds as "Codeforces Round (Div. 2)" and renames them once the round is
 * numbered, and an AtCoder contest is first inserted from the atcoder.jp scrape
 * then overwritten with the kenkoooo title. So the rule is:
 *
 *   • not started yet → re-derive, so a renamed round gets its proper URL;
 *   • started/finished → FREEZE, because that URL may already be indexed and
 *     linked, and changing it would throw away the ranking.
 *
 * Collisions (two contests sharing a title) walk the candidate ladder; the
 * unique index on Contest.slug is the final arbiter.
 */
async function upsertContest(
  c: NormalizedContest,
  data: NormalizedContest & { status: ContestStatus },
): Promise<void> {
  const where = { platform_externalId: { platform: c.platform, externalId: c.externalId } };
  const existing = await prisma.contest.findUnique({
    where,
    select: { id: true, slug: true, startTime: true },
  });

  const frozen = existing?.slug != null && existing.startTime.getTime() <= Date.now();
  if (existing && frozen) {
    await prisma.contest.update({ where: { id: existing.id }, data });
    return;
  }

  for (const slug of slugCandidates(c)) {
    try {
      await prisma.contest.upsert({ where, update: { ...data, slug }, create: { ...data, slug } });
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Slug taken by a different contest — try the next candidate.
    }
  }
  // Every candidate collided: keep the contest, leave the slug for the
  // self-healing pass below (the page falls back to the cuid meanwhile).
  await prisma.contest.upsert({ where, update: data, create: data });
}

/**
 * Give a slug to any contest that lacks one — rows written by an older deploy,
 * or ones whose candidates all collided. Bounded so a sync run stays quick.
 */
export async function fillMissingSlugs(): Promise<number> {
  const rows = await prisma.contest.findMany({
    where: { slug: null },
    take: 200,
    orderBy: { startTime: "asc" },
    select: { id: true, platform: true, externalId: true, title: true },
  });

  let filled = 0;
  for (const row of rows) {
    for (const slug of slugCandidates(row)) {
      try {
        await prisma.contest.update({ where: { id: row.id }, data: { slug } });
        filled++;
        break;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
  }
  return filled;
}

/**
 * Sync one source: fetch → upsert each contest → record health in SyncState.
 * Never throws — failures are captured in `lastError` so a broken source
 * degrades gracefully (the feed keeps serving every other source).
 */
export async function syncSource(
  source: Platform,
  fetchFn: () => Promise<NormalizedContest[]>,
): Promise<SyncResult> {
  await prisma.syncState.upsert({
    where: { source },
    update: { lastRunAt: new Date() },
    create: { source, lastRunAt: new Date() },
  });

  try {
    const contests = await fetchFn();
    for (const c of contests) {
      const data = { ...c, status: statusFor(c.startTime, c.endTime) };
      await upsertContest(c, data);
    }
    await prisma.syncState.update({
      where: { source },
      data: { lastSuccessAt: new Date(), lastError: null, contestsUpserted: contests.length },
    });
    return { source, ok: true, count: contests.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.syncState.update({ where: { source }, data: { lastError: error } });
    return { source, ok: false, error };
  }
}

const SOURCES: { source: Platform; fetchFn: () => Promise<NormalizedContest[]> }[] = [
  { source: "CODEFORCES", fetchFn: fetchCodeforces },
  { source: "LEETCODE", fetchFn: fetchLeetCode },
  { source: "CODECHEF", fetchFn: fetchCodeChef },
  { source: "ATCODER", fetchFn: fetchAtCoder },
];

/**
 * Contests are now kept PERMANENTLY. They used to be deleted after ~6 months,
 * but each finished contest has a public, indexed page at /contests/<slug>;
 * deleting the row 404s a URL that has accumulated rankings and inbound links.
 * Growth is ~1.6 contests/day (~600 rows/year, a megabyte or two over years),
 * and every read path is time-filtered and indexed.
 *
 * Still swept: ContestResult cache rows with no matching contest (that table
 * has no FK to Contest, so a hand-deleted contest would leave rows behind).
 */
export async function pruneOldContests(): Promise<number> {
  await prisma.$executeRaw`
    DELETE FROM "ContestResult" cr
    WHERE NOT EXISTS (
      SELECT 1 FROM "Contest" c
      WHERE c.platform = cr.platform AND c."externalId" = cr."externalId"
    )`;
  return 0;
}

/**
 * Re-derive `status` from time across ALL stored contests. `syncSource` only sets
 * status for the contests a source currently returns, so one that drops out of a
 * source's API window (e.g. an old CodeChef Starters) would freeze at its last
 * value and keep showing as UPCOMING. These cheap bulk updates keep the column
 * honest so consumers that trust `status` (e.g. the landing page) stay correct.
 */
async function normalizeContestStatuses(): Promise<void> {
  const now = new Date();
  await prisma.contest.updateMany({
    where: { endTime: { lt: now }, status: { not: ContestStatus.FINISHED } },
    data: { status: ContestStatus.FINISHED },
  });
  await prisma.contest.updateMany({
    where: {
      startTime: { lte: now },
      endTime: { gte: now },
      status: { not: ContestStatus.ONGOING },
    },
    data: { status: ContestStatus.ONGOING },
  });
  await prisma.contest.updateMany({
    where: { startTime: { gt: now }, status: { not: ContestStatus.UPCOMING } },
    data: { status: ContestStatus.UPCOMING },
  });
}

/** Run all API-based syncs concurrently and independently. */
export async function runAllSyncs(): Promise<SyncResult[]> {
  const results = await Promise.all(
    SOURCES.map(({ source, fetchFn }) => syncSource(source, fetchFn)),
  );
  // Self-heal statuses for contests no longer in any source's fetch window.
  try {
    await normalizeContestStatuses();
  } catch (err) {
    console.error("[sync] status normalization failed", err);
  }
  // Fan newly-synced contests out to platform followers (never block the sync).
  try {
    await syncAllAutoBookmarks();
  } catch {
    // auto-bookmark fan-out is best-effort; contest data already saved above.
  }
  // Give a URL to anything that still lacks one (never block the sync).
  try {
    const filled = await fillMissingSlugs();
    if (filled > 0) console.log(`[sync] filled ${filled} missing contest slugs`);
  } catch (err) {
    console.error("[sync] slug fill failed", err);
  }
  // Drop orphaned result-cache rows (never block the sync on cleanup).
  try {
    await pruneOldContests();
  } catch (err) {
    console.error("[sync] cache cleanup failed", err);
  }
  return results;
}
