import type { Duel, PrismaClient } from "@/generated/prisma/client";

import { fetchWindowAcs } from "./cf-judge";
import type { DuelProblem } from "./select-problems";

/** Live checks are shared by all viewers via lastCheckedAt — at most one CF
 * round-trip per duel per this interval, no matter how many tabs poll. */
const CHECK_THROTTLE_MS = 15_000;

/** Submissions to scan per player: recent page while live; deep enough at
 * finalize to cover everything submitted during a ≤2h duel. */
const LIVE_SCAN = 100;
const FINAL_SCAN = 1000;

/** Safely coerce the Duel.problems Json column. */
export function parseProblems(json: unknown): DuelProblem[] {
  return Array.isArray(json) ? (json as DuelProblem[]) : [];
}

/** Solve count + penalty (sum of seconds from duel start to each solve) for one
 * side. A = challenger, B = opponent. */
export function scoreOf(
  problems: DuelProblem[],
  startedAt: Date,
  side: "A" | "B",
): { solved: number; penaltySec: number } {
  let solved = 0;
  let penaltySec = 0;
  for (const p of problems) {
    const at = side === "A" ? p.solvedByA : p.solvedByB;
    if (!at) continue;
    solved += 1;
    penaltySec += Math.max(0, Math.round((Date.parse(at) - startedAt.getTime()) / 1000));
  }
  return { solved, penaltySec };
}

type Decision = {
  finished: boolean;
  winnerId: string | null;
  draw: boolean;
  finishedAt: Date | null;
};

/** Pure win logic, unified across formats via winTarget:
 *  - winTarget != null → first side whose winTarget-th solve comes earliest
 *    ends the duel at that moment (FIRST_SOLVE = 1, RACE = problemCount).
 *  - past endsAt → most solves, tie → lower penalty, tie → draw. */
export function decideWinner(
  duel: Pick<Duel, "challengerId" | "opponentId" | "winTarget" | "endsAt" | "startedAt">,
  problems: DuelProblem[],
  now: Date,
): Decision {
  const notDone: Decision = { finished: false, winnerId: null, draw: false, finishedAt: null };
  if (!duel.startedAt || !duel.endsAt) return notDone;

  const solveTimes = (side: "A" | "B") =>
    problems
      .map((p) => (side === "A" ? p.solvedByA : p.solvedByB))
      .filter((t): t is string => t != null)
      .map((t) => Date.parse(t))
      .sort((x, y) => x - y);

  const timesA = solveTimes("A");
  const timesB = solveTimes("B");

  // Early finish: winTarget-th solve, whichever side got there first.
  if (duel.winTarget != null) {
    const targetA = timesA.length >= duel.winTarget ? timesA[duel.winTarget - 1] : null;
    const targetB = timesB.length >= duel.winTarget ? timesB[duel.winTarget - 1] : null;
    if (targetA != null || targetB != null) {
      if (targetA != null && (targetB == null || targetA < targetB)) {
        return { finished: true, winnerId: duel.challengerId, draw: false, finishedAt: new Date(targetA) };
      }
      if (targetB != null && (targetA == null || targetB < targetA)) {
        return { finished: true, winnerId: duel.opponentId, draw: false, finishedAt: new Date(targetB) };
      }
      // Identical timestamps (same second) — call it a draw.
      return { finished: true, winnerId: null, draw: true, finishedAt: new Date(targetA!) };
    }
  }

  // Clock ran out: score it.
  if (now.getTime() > duel.endsAt.getTime()) {
    const a = scoreOf(problems, duel.startedAt, "A");
    const b = scoreOf(problems, duel.startedAt, "B");
    let winnerId: string | null = null;
    if (a.solved !== b.solved) winnerId = a.solved > b.solved ? duel.challengerId : duel.opponentId;
    else if (a.solved > 0 && a.penaltySec !== b.penaltySec) {
      winnerId = a.penaltySec < b.penaltySec ? duel.challengerId : duel.opponentId;
    }
    return { finished: true, winnerId, draw: winnerId == null, finishedAt: duel.endsAt };
  }

  return notDone;
}

/** Check an ACTIVE duel against Codeforces and persist any progress. Lazy —
 * called from duel.state / duel.list; throttled and stampede-guarded so
 * concurrent viewers share one upstream check. Returns the freshest row
 * (stale on throttle-skip or CF failure — never throws for those). */
export async function checkDuel(db: PrismaClient, duel: Duel): Promise<Duel> {
  if (duel.status !== "ACTIVE" || !duel.startedAt || !duel.endsAt) return duel;
  if (!duel.challengerHandle || !duel.opponentHandle) return duel;

  const now = new Date();
  if (duel.lastCheckedAt && now.getTime() - duel.lastCheckedAt.getTime() < CHECK_THROTTLE_MS) {
    return duel;
  }

  // Claim the check: only one concurrent caller flips lastCheckedAt forward.
  const claimed = await db.duel.updateMany({
    where: {
      id: duel.id,
      status: "ACTIVE",
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(now.getTime() - CHECK_THROTTLE_MS) } },
      ],
    },
    data: { lastCheckedAt: now },
  });
  if (claimed.count === 0) {
    return (await db.duel.findUnique({ where: { id: duel.id } })) ?? duel;
  }

  const problems = parseProblems(duel.problems);
  const fromSec = Math.floor(duel.startedAt.getTime() / 1000);
  const toSec = Math.floor(duel.endsAt.getTime() / 1000);
  const overdue = now.getTime() > duel.endsAt.getTime();
  const scan = overdue ? FINAL_SCAN : LIVE_SCAN;

  let acsA: Map<string, number>;
  let acsB: Map<string, number>;
  try {
    [acsA, acsB] = await Promise.all([
      fetchWindowAcs(duel.challengerHandle, fromSec, toSec, scan),
      fetchWindowAcs(duel.opponentHandle, fromSec, toSec, scan),
    ]);
  } catch {
    // CF unavailable — serve the stale state; the bumped lastCheckedAt is a
    // natural backoff before the next attempt.
    return { ...duel, lastCheckedAt: now };
  }

  let changed = false;
  for (const p of problems) {
    if (p.solvedByA == null) {
      const t = acsA.get(p.key);
      if (t !== undefined) {
        p.solvedByA = new Date(t * 1000).toISOString();
        changed = true;
      }
    }
    if (p.solvedByB == null) {
      const t = acsB.get(p.key);
      if (t !== undefined) {
        p.solvedByB = new Date(t * 1000).toISOString();
        changed = true;
      }
    }
  }

  const decision = decideWinner(duel, problems, now);

  if (!changed && !decision.finished) return { ...duel, lastCheckedAt: now };

  return db.duel.update({
    where: { id: duel.id },
    data: {
      problems: problems as object[],
      ...(decision.finished
        ? {
            status: "FINISHED" as const,
            winnerId: decision.winnerId,
            draw: decision.draw,
            finishedAt: decision.finishedAt,
          }
        : {}),
    },
  });
}
