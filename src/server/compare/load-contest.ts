import {
  type ContestPerformance,
  type ContestSide,
  compareContestPerf,
  type ContestCompareResult,
} from "@/lib/contest-compare";
import { prisma } from "@/lib/db";
import { normalizeUsername } from "@/lib/username";
import {
  type ContestPerfResult,
  type ContestRef,
  fetchContestPerformance,
} from "@/server/profile-sync/contest-perf";
import { isProfilePlatform, type ProfilePlatform } from "@/server/profile-sync/index";

export type ContestComparison = {
  result: ContestCompareResult;
  viewerId: string;
  isSelf: boolean;
  /** A side whose result couldn't be fetched (e.g. CodeChef scrape outage) — the
   * UI shows a "couldn't load" note instead of hard-failing the whole view. */
  viewerUnavailable: boolean;
  friendUnavailable: boolean;
};

export type ContestCompareOutcome =
  | { status: "ok"; comparison: ContestComparison }
  | { status: "not-found" }
  | { status: "not-friends"; targetLabel: string }
  | { status: "no-handle"; targetLabel: string; viewerMissing: boolean; friendMissing: boolean }
  | { status: "not-participated"; targetLabel: string; who: "viewer" | "friend" | "both" }
  | { status: "pending-results"; targetLabel: string };

const USER_SELECT = { id: true, username: true, name: true, image: true } as const;

const EMPTY_PERF: ContestPerformance = {
  participated: false,
  rank: null,
  ratingBefore: null,
  ratingAfter: null,
  ratingDelta: null,
  problemsSolved: null,
  performance: null,
};

/** Look up a verified handle on `platform` for a user. */
function verifiedHandle(userId: string, platform: ProfilePlatform) {
  return prisma.platformHandle.findFirst({
    where: { userId, platform, verified: true },
    select: { handle: true },
  });
}

/** Cache-first fetch of one performance. Reads/writes are best-effort: a missing
 * cache table (pre-migration) or any cache error simply falls back to a live
 * fetch. Only successful results are cached (they're immutable once rated). */
async function loadPerf(
  platform: ProfilePlatform,
  handle: string,
  ref: ContestRef,
): Promise<ContestPerfResult> {
  const key = handle.toLowerCase();
  try {
    const cached = await prisma.contestResult.findUnique({
      where: { platform_externalId_handle: { platform, externalId: ref.externalId, handle: key } },
    });
    if (cached) {
      return {
        state: "ok",
        perf: {
          participated: true,
          rank: cached.rank,
          ratingBefore: cached.ratingBefore,
          ratingAfter: cached.ratingAfter,
          ratingDelta: cached.ratingDelta,
          problemsSolved: cached.problemsSolved,
          performance: cached.performance,
        },
      };
    }
  } catch {
    // cache unavailable — fall through to live fetch
  }

  const result = await fetchContestPerformance(platform, handle, ref);

  if (result.state === "ok") {
    const p = result.perf;
    try {
      await prisma.contestResult.upsert({
        where: { platform_externalId_handle: { platform, externalId: ref.externalId, handle: key } },
        create: {
          platform,
          externalId: ref.externalId,
          handle: key,
          rank: p.rank,
          ratingBefore: p.ratingBefore,
          ratingAfter: p.ratingAfter,
          ratingDelta: p.ratingDelta,
          problemsSolved: p.problemsSolved,
          performance: p.performance,
        },
        update: {
          rank: p.rank,
          ratingBefore: p.ratingBefore,
          ratingAfter: p.ratingAfter,
          ratingDelta: p.ratingDelta,
          problemsSolved: p.problemsSolved,
          performance: p.performance,
          fetchedAt: new Date(),
        },
      });
    } catch {
      // ignore cache write failures
    }
  }

  return result;
}

/**
 * Resolve viewer + friend, enforce the friend-or-self gate, fetch both users'
 * performance on a specific contest, and run the deterministic comparison.
 * Shared by the page and the `contest.compareOnContest` procedure so the gating
 * + fetching can't drift apart (mirrors `loadComparison` in load.ts).
 */
export async function loadContestComparison(
  viewerId: string,
  contestId: string,
  friendUsernameRaw: string,
): Promise<ContestCompareOutcome> {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest || !isProfilePlatform(contest.platform)) return { status: "not-found" };
  const platform = contest.platform;

  const [me, them] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, select: USER_SELECT }),
    prisma.user.findUnique({
      where: { username: normalizeUsername(friendUsernameRaw) },
      select: USER_SELECT,
    }),
  ]);
  if (!me || !them) return { status: "not-found" };

  const isSelf = me.id === them.id;
  const targetLabel = them.name ?? them.username ?? friendUsernameRaw;

  if (!isSelf) {
    const friends = await prisma.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: me.id, addresseeId: them.id },
          { requesterId: them.id, addresseeId: me.id },
        ],
      },
    });
    if (friends === 0) return { status: "not-friends", targetLabel };
  }

  const [myHandle, theirHandle] = await Promise.all([
    verifiedHandle(me.id, platform),
    isSelf ? null : verifiedHandle(them.id, platform),
  ]);
  const friendHandle = isSelf ? myHandle : theirHandle;
  if (!myHandle || !friendHandle) {
    return {
      status: "no-handle",
      targetLabel,
      viewerMissing: !myHandle,
      friendMissing: !friendHandle,
    };
  }

  const ref: ContestRef = {
    externalId: contest.externalId,
    startTime: contest.startTime,
    endTime: contest.endTime,
  };
  const [mine, theirs] = await Promise.all([
    loadPerf(platform, myHandle.handle, ref),
    loadPerf(platform, friendHandle.handle, ref),
  ]);

  // Pending takes precedence — ratings not applied yet, ask the user to wait.
  if (mine.state === "pending" || theirs.state === "pending") {
    return { status: "pending-results", targetLabel };
  }
  // Then "didn't enter" — a per-contest compare needs both to have competed.
  const meAbsent = mine.state === "not-participated";
  const themAbsent = theirs.state === "not-participated";
  if (meAbsent || themAbsent) {
    const who = meAbsent && themAbsent ? "both" : meAbsent ? "viewer" : "friend";
    return { status: "not-participated", targetLabel, who };
  }

  const sideA: ContestSide = {
    username: me.username,
    name: me.name,
    image: me.image,
    perf: mine.state === "ok" ? mine.perf : EMPTY_PERF,
  };
  const sideB: ContestSide = {
    username: them.username,
    name: them.name,
    image: them.image,
    perf: theirs.state === "ok" ? theirs.perf : EMPTY_PERF,
  };

  return {
    status: "ok",
    comparison: {
      result: compareContestPerf(sideA, sideB, {
        platform,
        contestTitle: contest.title,
        contestUrl: contest.url,
      }),
      viewerId: me.id,
      isSelf,
      viewerUnavailable: mine.state === "unavailable",
      friendUnavailable: theirs.state === "unavailable",
    },
  };
}
