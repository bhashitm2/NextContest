import { ContestStatus, type Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { fetchAtCoder } from "./atcoder";
import { syncAllAutoBookmarks } from "./auto-bookmarks";
import { fetchCodeChef } from "./codechef";
import { fetchCodeforces } from "./codeforces";
import { fetchLeetCode } from "./leetcode";
import { type NormalizedContest, PRUNE_WINDOW_DAYS, pruneCutoffMs } from "./types";

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
      await prisma.contest.upsert({
        where: { platform_externalId: { platform: c.platform, externalId: c.externalId } },
        update: data,
        create: data,
      });
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
 * Retention: keep only ~6 months of contests. Deletes contests that started
 * before the prune cutoff (cascades to their Bookmarks + CalendarTombstones)
 * and drops now-orphaned ContestResult cache rows (no FK to Contest). Returns
 * the number of contests removed. Best-effort — callers swallow failures.
 */
export async function pruneOldContests(): Promise<number> {
  const { count } = await prisma.contest.deleteMany({
    where: { startTime: { lt: new Date(pruneCutoffMs()) } },
  });
  // ContestResult has no FK to Contest, so clean up cache rows whose contest is
  // gone (the per-contest compare can't be opened for a deleted contest anyway).
  await prisma.$executeRaw`
    DELETE FROM "ContestResult" cr
    WHERE NOT EXISTS (
      SELECT 1 FROM "Contest" c
      WHERE c.platform = cr.platform AND c."externalId" = cr."externalId"
    )`;
  return count;
}

/** Run all API-based syncs concurrently and independently. */
export async function runAllSyncs(): Promise<SyncResult[]> {
  const results = await Promise.all(
    SOURCES.map(({ source, fetchFn }) => syncSource(source, fetchFn)),
  );
  // Fan newly-synced contests out to platform followers (never block the sync).
  try {
    await syncAllAutoBookmarks();
  } catch {
    // auto-bookmark fan-out is best-effort; contest data already saved above.
  }
  // Enforce the ~6-month retention window (never block the sync on cleanup).
  try {
    const pruned = await pruneOldContests();
    if (pruned > 0) console.log(`[sync] pruned ${pruned} contests older than ${PRUNE_WINDOW_DAYS}d`);
  } catch (err) {
    console.error("[sync] prune failed", err);
  }
  return results;
}
