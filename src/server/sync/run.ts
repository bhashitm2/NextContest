import { ContestStatus, type Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { fetchAtCoder } from "./atcoder";
import { syncAllAutoBookmarks } from "./auto-bookmarks";
import { fetchCodeChef } from "./codechef";
import { fetchCodeforces } from "./codeforces";
import { fetchLeetCode } from "./leetcode";
import type { NormalizedContest } from "./types";

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
  return results;
}
