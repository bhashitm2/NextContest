import { prisma } from "@/lib/db";

import { fetchStats, isProfilePlatform, statsToHandleData } from "./index";

/** Re-fetch stats for verified handles whose data is older than this. */
const STALE_MS = 24 * 60 * 60 * 1000;
/** Cap per run so a single cron invocation stays within the function timeout. */
const BATCH = 40;
/** Small pause between fetches to stay rate-respectful. */
const PACE_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RefreshResult = { total: number; refreshed: number; failed: number };

/** Refresh the most-stale verified handles. Errors are isolated per handle. */
export async function refreshStaleHandles(): Promise<RefreshResult> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.platformHandle.findMany({
    where: {
      verified: true,
      OR: [{ lastSynced: null }, { lastSynced: { lt: cutoff } }],
    },
    orderBy: { lastSynced: { sort: "asc", nulls: "first" } },
    take: BATCH,
  });

  let refreshed = 0;
  let failed = 0;
  for (const row of stale) {
    if (!isProfilePlatform(row.platform)) continue;
    try {
      const stats = await fetchStats(row.platform, row.handle);
      await prisma.platformHandle.update({ where: { id: row.id }, data: statsToHandleData(stats) });
      refreshed += 1;
    } catch {
      // Leave existing stats intact; bump lastSynced so we don't hammer a broken handle.
      await prisma.platformHandle.update({ where: { id: row.id }, data: { lastSynced: new Date() } });
      failed += 1;
    }
    await sleep(PACE_MS);
  }

  return { total: stale.length, refreshed, failed };
}
