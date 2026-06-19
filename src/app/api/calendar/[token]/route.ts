import { prisma } from "@/lib/db";
import { buildCalendarFeed } from "@/lib/calendar";
import { PLATFORM_META } from "@/lib/platforms";
import type { Platform } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * Personal subscribable contest calendar.
 *   GET /api/calendar/<token>.ics
 * Returns an iCalendar feed of every contest the user follows/bookmarked, each
 * with an alarm before it starts. Calendar apps (Google/Apple/Outlook) re-fetch
 * this on their own schedule, so newly-followed contests appear automatically.
 *
 * Auth is the unguessable token in the URL — calendar clients can't send
 * headers, so the secret lives in the path.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  // The URL ends in ".ics" so clients treat it as a calendar; strip it.
  const token = raw.replace(/\.ics$/i, "");

  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  // Active bookmarks (auto-followed or manual) + tombstones for contests the
  // user un-followed — the latter emitted as STATUS:CANCELLED so subscribed
  // calendars actually remove them. Both limited to contests that haven't ended.
  const now = new Date();
  const [bookmarks, tombstones] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId: user.id, contest: { endTime: { gte: now } } },
      include: { contest: true },
      orderBy: { contest: { startTime: "asc" } },
    }),
    prisma.calendarTombstone.findMany({
      where: { userId: user.id, contest: { endTime: { gte: now } } },
      include: { contest: true },
    }),
  ]);

  const eventFromContest = (c: {
    platform: Platform;
    title: string;
    url: string;
    startTime: Date;
    endTime: Date;
    externalId: string;
  }) => ({
    title: `${PLATFORM_META[c.platform]?.label ?? c.platform}: ${c.title}`,
    url: c.url,
    startTime: c.startTime,
    endTime: c.endTime,
    platform: c.platform,
    externalId: c.externalId,
  });

  const activeIds = new Set(bookmarks.map((b) => b.contestId));
  const events = [
    ...bookmarks.map((b) => ({
      ...eventFromContest(b.contest),
      notify24h: b.notify24h,
      notify1h: b.notify1h,
    })),
    // Don't cancel a contest that's still actively bookmarked another way.
    ...tombstones
      .filter((t) => !activeIds.has(t.contestId))
      .map((t) => ({ ...eventFromContest(t.contest), cancelled: true })),
  ];

  const ics = buildCalendarFeed(events, {
    name: user.name ? `NextContest — ${user.name}` : "NextContest",
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nextcontest.ics"',
      // Let CDNs/clients cache briefly; the feed updates as contests sync.
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
