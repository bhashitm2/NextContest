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

  // Every bookmarked contest (auto-followed or manual) that hasn't ended yet.
  const now = new Date();
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id, contest: { endTime: { gte: now } } },
    include: { contest: true },
    orderBy: { contest: { startTime: "asc" } },
  });

  const events = bookmarks.map((b) => ({
    title: `${PLATFORM_META[b.contest.platform as Platform]?.label ?? b.contest.platform}: ${b.contest.title}`,
    url: b.contest.url,
    startTime: b.contest.startTime,
    endTime: b.contest.endTime,
    platform: b.contest.platform,
    externalId: b.contest.externalId,
    notify24h: b.notify24h,
    notify1h: b.notify1h,
  }));

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
