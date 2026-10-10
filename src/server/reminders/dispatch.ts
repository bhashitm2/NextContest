import type { Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { sendContestReminder, type ReminderKind } from "@/server/email/mailer";

const HOUR = 60 * 60 * 1000;

/**
 * How far ahead the "starting soon" reminder looks.
 *
 * Deliberately WIDER than the 1 hour it's named after. The reminder cron runs
 * on GitHub Actions, which heavily throttles scheduled workflows: a declared
 * 15-minute schedule was measured running ~6x/day, average gap 5h, worst 8h.
 * A strict 60-minute window is simply skipped when no run lands inside it, and
 * the bookmark then falls out of the query forever once the contest starts —
 * which silently lost 59% of these reminders.
 *
 * Widening only reduces the odds; the real fix is running this endpoint on a
 * reliable 5-minute schedule (see README / docs). With that in place a 2h
 * window still fires close to the intended time, and the email states the true
 * time remaining either way, so it is never misleading.
 */
const SOON_WINDOW_MS = 2 * HOUR;

type DispatchResult = { sent24h: number; sent1h: number; failed: number };

/**
 * Find bookmarks whose contest is entering a reminder window and email the
 * owner. Idempotent: each reminder is sent once (guarded by notified*At), so
 * a failed send is naturally retried on the next run.
 */
export async function runReminderDispatch(): Promise<DispatchResult> {
  const now = new Date();
  const soon = new Date(now.getTime() + SOON_WINDOW_MS);
  const in24h = new Date(now.getTime() + 24 * HOUR);

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;

  // 24h reminder: contest is between the "soon" window and 24h away, so it
  // can't collide with the imminent-contest reminder below.
  const due24h = await prisma.bookmark.findMany({
    where: {
      notify24h: true,
      notified24hAt: null,
      contest: { startTime: { gt: soon, lte: in24h } },
    },
    include: { contest: true, user: true },
  });

  for (const b of due24h) {
    if (!b.user.email) continue;
    try {
      await sendReminder(b, "24h");
      await prisma.bookmark.update({ where: { id: b.id }, data: { notified24hAt: new Date() } });
      sent24h++;
    } catch {
      failed++;
    }
  }

  // Imminent reminder: contest starts within SOON_WINDOW_MS and hasn't started.
  const due1h = await prisma.bookmark.findMany({
    where: {
      notify1h: true,
      notified1hAt: null,
      contest: { startTime: { gt: now, lte: soon } },
    },
    include: { contest: true, user: true },
  });

  for (const b of due1h) {
    if (!b.user.email) continue;
    try {
      await sendReminder(b, "1h");
      await prisma.bookmark.update({ where: { id: b.id }, data: { notified1hAt: new Date() } });
      sent1h++;
    } catch {
      failed++;
    }
  }

  return { sent24h, sent1h, failed };
}

async function sendReminder(
  b: {
    user: { email: string | null; timezone: string | null };
    contest: {
      title: string;
      url: string;
      startTime: Date;
      durationSeconds: number;
      platform: Platform;
    };
  },
  kind: ReminderKind,
) {
  await sendContestReminder({
    to: b.user.email!,
    contestTitle: b.contest.title,
    contestUrl: b.contest.url,
    startTime: b.contest.startTime,
    durationSeconds: b.contest.durationSeconds,
    platform: b.contest.platform,
    timezone: b.user.timezone,
    kind,
  });
}
