import type { Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Prefs = { notify24h: boolean; notify1h: boolean };

/**
 * Ensure auto-bookmarks exist for a user's subscription to a platform — one per
 * upcoming contest. Idempotent: existing bookmarks (manual or auto) are skipped,
 * so a manual bookmark is never overwritten. Returns the number created.
 */
export async function ensureAutoBookmarks(
  userId: string,
  platform: Platform,
  prefs: Prefs,
): Promise<number> {
  const contests = await prisma.contest.findMany({
    where: { platform, startTime: { gt: new Date() } },
    select: { id: true },
  });
  if (contests.length === 0) return 0;

  const contestIds = contests.map((c) => c.id);
  // Re-following clears any "cancelled" tombstones so the feed stops cancelling
  // these contests and shows them again.
  await prisma.calendarTombstone.deleteMany({
    where: { userId, contestId: { in: contestIds } },
  });

  const res = await prisma.bookmark.createMany({
    data: contests.map((c) => ({
      userId,
      contestId: c.id,
      auto: true,
      notify24h: prefs.notify24h,
      notify1h: prefs.notify1h,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

/** Remove auto-bookmarks for a user's platform. Manual bookmarks are untouched.
 * Leaves a tombstone for each still-upcoming contest so the calendar feed emits
 * STATUS:CANCELLED and subscribed calendars remove it. */
export async function removeAutoBookmarks(userId: string, platform: Platform): Promise<void> {
  const upcoming = await prisma.bookmark.findMany({
    where: { userId, auto: true, contest: { platform, endTime: { gte: new Date() } } },
    select: { contestId: true },
  });
  if (upcoming.length > 0) {
    await prisma.calendarTombstone.createMany({
      data: upcoming.map((b) => ({ userId, contestId: b.contestId })),
      skipDuplicates: true,
    });
  }
  await prisma.bookmark.deleteMany({
    where: { userId, auto: true, contest: { platform } },
  });
}

/**
 * Fan out: for every active subscription, ensure its auto-bookmarks are current.
 * Run after the contest sync so newly-synced contests get auto-followed.
 */
export async function syncAllAutoBookmarks(): Promise<number> {
  // Prune tombstones for contests that have already ended — the feed no longer
  // emits them, so the cancellation has served its purpose.
  await prisma.calendarTombstone.deleteMany({
    where: { contest: { endTime: { lt: new Date() } } },
  });

  const subs = await prisma.platformSubscription.findMany();
  let created = 0;
  for (const s of subs) {
    created += await ensureAutoBookmarks(s.userId, s.platform, {
      notify24h: s.notify24h,
      notify1h: s.notify1h,
    });
  }
  return created;
}
