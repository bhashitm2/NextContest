/**
 * One-off backfill: re-fetch stats for every connected handle so the analytics
 * fields (activity, ratingHistory) added in v1.6 are populated immediately
 * instead of waiting for the daily profiles cron.
 *
 *   npx tsx scripts/resync-handles.ts
 *
 * Uses DATABASE_URL from .env like the app. Paced to be gentle on the
 * platforms' APIs; failures are logged and skipped (best-effort, same as cron).
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { fetchStats, isProfilePlatform, statsToHandleData } from "../src/server/profile-sync";

const PACE_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const handles = await prisma.platformHandle.findMany({
    select: { id: true, platform: true, handle: true },
    orderBy: { platform: "asc" },
  });
  console.log(`Resyncing ${handles.length} handle(s)…`);

  let ok = 0;
  let failed = 0;
  for (const h of handles) {
    if (!isProfilePlatform(h.platform)) continue;
    try {
      const stats = await fetchStats(h.platform, h.handle);
      await prisma.platformHandle.update({
        where: { id: h.id },
        data: statsToHandleData(stats),
      });
      const extra = stats.extra;
      console.log(
        `  ok  ${h.platform} ${h.handle} — activity ${extra.activity?.length ?? 0}d, history ${extra.ratingHistory?.length ?? 0}pt`,
      );
      ok++;
    } catch (e) {
      console.warn(`  FAIL ${h.platform} ${h.handle}: ${e instanceof Error ? e.message : e}`);
      failed++;
    }
    await sleep(PACE_MS);
  }
  console.log(`Done: ${ok} ok, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
