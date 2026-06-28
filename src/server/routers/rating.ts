import { z } from "zod";

import { Platform } from "@/generated/prisma/client";
import { forecastFromDeltas, type RatingForecast } from "@/lib/rating-forecast";
import { normalizeUsername } from "@/lib/username";
import { fetchRatingHistory, type RatingHistoryEntry } from "@/server/predictions/history";
import {
  fetchCodeforcesLeaderboard,
  fetchCodeforcesProblems,
} from "@/server/predictions/codeforces/leaderboard";
import { fetchLeetCodeLeaderboard } from "@/server/predictions/leetcode/leaderboard";
import { fetchLeetCodeQuestions } from "@/server/leetcode/contest-info";
import { getPrediction } from "@/server/predictions/service";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc";

/** A still-unrated contest at most this old is worth predicting. */
const PREDICT_TAIL_MS = 48 * 60 * 60 * 1000;

/** Platforms with a live contest-rating predictor. */
const PREDICTABLE = ["CODEFORCES", "LEETCODE"] as const;
type Predictable = (typeof PREDICTABLE)[number];

function isPredictable(p: Platform): p is Predictable {
  return (PREDICTABLE as readonly Platform[]).includes(p);
}

/** Platforms that expose per-contest rating history (→ a trend forecast). */
const FORECASTABLE: Platform[] = ["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"];

export const ratingRouter = createTRPCRouter({
  /** Predicted rating change for the signed-in user's verified handle on a contest. */
  forContest: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({ where: { id: input.contestId } });
      if (!contest) return { status: "not-found" as const };
      if (!isPredictable(contest.platform)) {
        return { status: "unsupported" as const, platform: contest.platform };
      }
      const handle = await ctx.db.platformHandle.findFirst({
        where: { userId: ctx.userId, platform: contest.platform, verified: true },
        select: { handle: true },
      });
      if (!handle) return { status: "no-handle" as const, platform: contest.platform };

      const prediction = await getPrediction(contest, handle.handle);
      return { status: "ok" as const, handle: handle.handle, prediction };
    }),

  /** Handle-first rating history: a handle's recent contests, each with its
   * rating change (actual for rated rounds; predicted for the latest unrated one). */
  history: publicProcedure
    .input(
      z.object({
        platform: z.enum(PREDICTABLE),
        handle: z.string().trim().min(1).max(64),
        limit: z.number().min(1).max(30).default(15),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await fetchRatingHistory(input.platform, input.handle, input.limit);
      if (result.status !== "ok") return result; // not-found | unavailable

      let entries: RatingHistoryEntry[] = result.entries;

      // Best-effort: prepend a PREDICTED entry for the latest synced contest the
      // handle joined that isn't rated yet. Heavy compute (standings) only runs
      // when such a recent contest actually exists.
      try {
        const ratedIds = new Set(entries.map((e) => e.externalId));
        const recent = await ctx.db.contest.findMany({
          where: { platform: input.platform, startTime: { lte: new Date() } },
          orderBy: { startTime: "desc" },
          take: 3,
          select: { platform: true, externalId: true, title: true, startTime: true, endTime: true },
        });
        const candidate = recent.find(
          (c) => !ratedIds.has(c.externalId) && Date.now() - c.endTime.getTime() < PREDICT_TAIL_MS,
        );
        if (candidate) {
          const pred = await getPrediction(candidate, input.handle);
          if (pred.state === "live" && pred.predictedDelta != null) {
            entries = [
              {
                externalId: candidate.externalId,
                contestTitle: candidate.title,
                date: candidate.startTime,
                rank: pred.rank,
                ratingBefore: pred.currentRating,
                ratingAfter: pred.projectedRating,
                delta: pred.predictedDelta,
                state: "live",
              },
              ...entries,
            ];
          }
        }
      } catch {
        // best-effort — actual history is enough on its own
      }

      return { status: "ok" as const, entries };
    }),

  /** Public lookup: any handle on any predictable contest. */
  lookup: publicProcedure
    .input(
      z.object({
        platform: z.enum(PREDICTABLE),
        handle: z.string().trim().min(1).max(64),
        contestId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({ where: { id: input.contestId } });
      if (!contest) return { status: "not-found" as const };
      if (contest.platform !== input.platform) return { status: "platform-mismatch" as const };

      const prediction = await getPrediction(contest, input.handle);
      return { status: "ok" as const, prediction };
    }),

  /** Recent predictable contests (already started → have standings), for the
   * public lookup tool's contest picker. */
  predictableContests: publicProcedure
    .input(z.object({ platform: z.enum(PREDICTABLE), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contest.findMany({
        where: { platform: input.platform, startTime: { lte: new Date() } },
        orderBy: { startTime: "desc" },
        take: input.limit,
        select: { id: true, title: true, startTime: true, endTime: true, platform: true },
      });
    }),

  /** Full ranklist for a contest (paginated), each row with its rating change.
   * LeetCode → self-hosted lccn-predictor; Codeforces → Carrot/official deltas. */
  leaderboard: publicProcedure
    .input(
      z.object({
        contestId: z.string(),
        page: z.number().min(1).max(2000).default(1),
        size: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({ where: { id: input.contestId } });
      if (!contest) return { status: "not-found" as const };
      if (contest.platform === "LEETCODE") {
        return fetchLeetCodeLeaderboard(contest.externalId, input.page, input.size);
      }
      if (contest.platform === "CODEFORCES") {
        return fetchCodeforcesLeaderboard(contest.externalId, input.page, input.size);
      }
      return { status: "unsupported" as const };
    }),

  /** The questions asked in a contest (LeetCode GraphQL / Codeforces standings). */
  contestQuestions: publicProcedure
    .input(z.object({ contestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({ where: { id: input.contestId } });
      if (!contest) return { status: "unavailable" as const, questions: [] };
      if (contest.platform === "LEETCODE") return fetchLeetCodeQuestions(contest.externalId);
      if (contest.platform === "CODEFORCES") return fetchCodeforcesProblems(contest.externalId);
      return { status: "unavailable" as const, questions: [] };
    }),

  /** Find one handle's row in a contest so the UI can pin it above the paginated
   * table (no need to page through tens of thousands of rows). Reuses the
   * existing single-user prediction path (LeetCode + Codeforces). */
  findInLeaderboard: publicProcedure
    .input(z.object({ contestId: z.string(), handle: z.string().trim().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({ where: { id: input.contestId } });
      if (!contest) return { status: "not-found" as const };
      if (contest.platform !== "LEETCODE" && contest.platform !== "CODEFORCES") {
        return { status: "unsupported" as const };
      }

      const pred = await getPrediction(contest, input.handle);
      if ((pred.state === "live" || pred.state === "final") && pred.rank != null) {
        const profileUrl =
          contest.platform === "CODEFORCES"
            ? `https://codeforces.com/profile/${encodeURIComponent(input.handle)}`
            : `https://leetcode.com/u/${encodeURIComponent(input.handle)}/`;
        return {
          status: "ok" as const,
          row: {
            rank: pred.rank,
            displayName: input.handle,
            profileUrl,
            oldRating: pred.currentRating,
            delta: pred.predictedDelta,
            newRating: pred.projectedRating,
            score: null,
          },
        };
      }
      if (pred.state === "pending") return { status: "computing" as const };
      if (pred.state === "not-participated") return { status: "not-found" as const };
      return { status: "unavailable" as const };
    }),

  /** Trend forecast (per platform) from a user's cached contest history. */
  forecast: publicProcedure
    .input(z.object({ username: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const username = input?.username;
      const userId = username
        ? (
            await ctx.db.user.findUnique({
              where: { username: normalizeUsername(username) },
              select: { id: true },
            })
          )?.id
        : ctx.userId;
      if (!userId) return [] as { platform: Platform; handle: string; forecast: RatingForecast }[];

      const handles = await ctx.db.platformHandle.findMany({
        where: { userId, verified: true, platform: { in: FORECASTABLE } },
        select: { platform: true, handle: true, rating: true },
      });

      const out: { platform: Platform; handle: string; forecast: RatingForecast }[] = [];
      for (const h of handles) {
        const key = h.handle.toLowerCase();
        const results = await ctx.db.contestResult.findMany({
          where: { platform: h.platform, handle: key, ratingDelta: { not: null } },
          select: { externalId: true, ratingDelta: true, ratingAfter: true },
        });
        if (results.length < 3) continue;

        // Order chronologically by the contest's start time.
        const contests = await ctx.db.contest.findMany({
          where: { platform: h.platform, externalId: { in: results.map((r) => r.externalId) } },
          select: { externalId: true, startTime: true },
        });
        const timeOf = new Map(contests.map((c) => [c.externalId, c.startTime.getTime()]));
        const ordered = [...results].sort(
          (a, b) => (timeOf.get(a.externalId) ?? 0) - (timeOf.get(b.externalId) ?? 0),
        );

        const deltas = ordered.map((r) => r.ratingDelta!).filter((d) => d != null);
        const currentRating = ordered[ordered.length - 1]?.ratingAfter ?? h.rating ?? null;
        out.push({
          platform: h.platform,
          handle: h.handle,
          forecast: forecastFromDeltas(deltas, currentRating),
        });
      }
      return out;
    }),
});
