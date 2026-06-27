/**
 * Predictions cron: pre-warm rating predictions for connected users.
 *
 * Targets Codeforces contests in the prediction window — started, and ended no
 * more than ~36h ago (CF usually rates within a day; the tail lets a later run
 * flip the cached row from "live" to the official "final"). One FFT compute per
 * contest serves every connected handle, so this stays cheap.
 */
import { prisma } from "@/lib/db";

import { refreshCodeforcesContest } from "./service";

/** Keep refreshing up to this long after a contest ends (until it's rated). */
const RATE_TAIL_MS = 36 * 60 * 60 * 1000;
/** Safety cap so one run can't fan out unboundedly. */
const MAX_CONTESTS = 8;

export type PredictionRunSummary = {
  contests: number;
  handles: number;
  results: Array<{ externalId: string; rated?: boolean; stored?: number; note?: string }>;
};

export async function runPredictions(): Promise<PredictionRunSummary> {
  const now = Date.now();
  const contests = await prisma.contest.findMany({
    where: {
      platform: "CODEFORCES",
      startTime: { lte: new Date() },
      endTime: { gte: new Date(now - RATE_TAIL_MS) },
    },
    orderBy: { startTime: "desc" },
    take: MAX_CONTESTS,
  });

  const handleRows = await prisma.platformHandle.findMany({
    where: { platform: "CODEFORCES", verified: true },
    select: { handle: true },
  });
  const handles = [...new Set(handleRows.map((h) => h.handle))];

  const results: PredictionRunSummary["results"] = [];
  if (handles.length === 0) {
    return { contests: contests.length, handles: 0, results };
  }

  for (const c of contests) {
    // Skip contests already finalized by an earlier run.
    const run = await prisma.predictionRun.findUnique({
      where: { platform_externalId: { platform: "CODEFORCES", externalId: c.externalId } },
    });
    if (run?.rated) {
      results.push({ externalId: c.externalId, note: "already-final" });
      continue;
    }
    try {
      const r = await refreshCodeforcesContest(c, handles);
      results.push(r ? { externalId: c.externalId, ...r } : { externalId: c.externalId, note: "no-data" });
    } catch {
      results.push({ externalId: c.externalId, note: "error" });
    }
  }

  return { contests: contests.length, handles: handles.length, results };
}
