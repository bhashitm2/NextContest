import type { Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { sendContestReminder, type ReminderKind } from "@/server/email/mailer";

const HOUR = 60 * 60 * 1000;

type DispatchResult = { sent24h: number; sent1h: number; failed: number };

/**
 * Find bookmarks whose contest is entering a reminder window and email the
 * owner. Idempotent: each reminder is sent once (guarded by notified*At), so
 * a failed send is naturally retried on the next run.
 */
export async function runReminderDispatch(): Promise<DispatchResult> {
  const now = new Date();
  const in1h = new Date(now.getTime() + HOUR);
  const in24h = new Date(now.getTime() + 24 * HOUR);

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;

  // 24h reminder: contest is between 1h and 24h away (so it doesn't collide
  // with the 1h reminder for imminent contests).
  const due24h = await prisma.bookmark.findMany({
    where: {
      notify24h: true,
      notified24hAt: null,
      contest: { startTime: { gt: in1h, lte: in24h } },
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

  // 1h reminder: contest is within the next hour (and hasn't started).
  const due1h = await prisma.bookmark.findMany({
    where: {
      notify1h: true,
      notified1hAt: null,
      contest: { startTime: { gt: now, lte: in1h } },
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
