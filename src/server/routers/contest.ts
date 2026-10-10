import { z } from "zod";

import { ContestStatus, Platform } from "@/generated/prisma/client";
import { loadContestComparison } from "@/server/compare/load-contest";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc";

/**
 * Derive the status filter from TIME, not the stored `status` enum. `status` is
 * only recomputed for contests the sync currently fetches, so one that falls out
 * of a source's API window (e.g. an old CodeChef Starters that CodeChef no longer
 * returns) freezes at its last value — and would otherwise leak into the Upcoming
 * feed forever. "Upcoming" here means "not yet finished" (upcoming + currently
 * live), the complement of the `finished` feed's `endTime < now`.
 */
function statusWhere(status: ContestStatus | undefined, now: Date) {
  switch (status) {
    case ContestStatus.UPCOMING:
      return { endTime: { gte: now } };
    case ContestStatus.ONGOING:
      return { startTime: { lte: now }, endTime: { gte: now } };
    case ContestStatus.FINISHED:
      return { endTime: { lt: now } };
    default:
      return {};
  }
}

export const contestRouter = createTRPCRouter({
  /** Paginated, filterable contest list (cursor-based for infinite scroll). */
  getAll: publicProcedure
    .input(
      z
        .object({
          platforms: z.array(z.enum(Platform)).optional(),
          status: z.enum(ContestStatus).optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().nullish(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const items = await ctx.db.contest.findMany({
        where: {
          platform: input?.platforms?.length ? { in: input.platforms } : undefined,
          ...statusWhere(input?.status, new Date()),
        },
        orderBy: { startTime: "asc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  /** Contests starting within the next N days (default 7). */
  upcoming: publicProcedure
    .input(z.object({ days: z.number().min(1).max(30).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const now = new Date();
      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      return ctx.db.contest.findMany({
        where: { startTime: { gte: now, lte: until } },
        orderBy: { startTime: "asc" },
      });
    }),

  /** Single contest with full details. */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contest.findUnique({ where: { id: input.id } });
    }),

  /** Finished contests (most-recent first), for the per-contest compare entry.
   * Past-state is derived from `endTime < now`, NOT the `status` enum — nothing
   * auto-transitions `status`, so trusting it would silently miss contests. */
  finished: publicProcedure
    .input(
      z
        .object({
          platforms: z.array(z.enum(Platform)).optional(),
          limit: z.number().min(1).max(400).default(120),
          /** Offset paging for the archive: contests are kept permanently, so
           * the list outgrows any single page and older ones would otherwise
           * have no link pointing at them. */
          skip: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        endTime: { lt: new Date() },
        platform: input?.platforms?.length ? { in: input.platforms } : undefined,
      };
      const [items, total] = await Promise.all([
        ctx.db.contest.findMany({
          where,
          orderBy: { endTime: "desc" },
          take: input?.limit ?? 120,
          skip: input?.skip ?? 0,
        }),
        ctx.db.contest.count({ where }),
      ]);
      return { items, total };
    }),

  /** Friends who have a verified handle on this contest's platform — i.e. those
   * the viewer can run a per-contest comparison against. */
  eligibleFriends: protectedProcedure
    .input(z.object({ contestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contest = await ctx.db.contest.findUnique({
        where: { id: input.contestId },
        select: { platform: true },
      });
      if (!contest) return [];
      const handleFilter = {
        where: { platform: contest.platform, verified: true },
        select: { handle: true },
      } as const;
      const profileSelect = {
        username: true,
        name: true,
        image: true,
        handles: handleFilter,
      } as const;

      const edges = await ctx.db.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: ctx.userId }, { addresseeId: ctx.userId }],
        },
        include: {
          requester: { select: profileSelect },
          addressee: { select: profileSelect },
        },
        orderBy: { respondedAt: "desc" },
      });

      return edges
        .map((e) => (e.requesterId === ctx.userId ? e.addressee : e.requester))
        .filter((f) => f.username && f.handles.length > 0)
        .map((f) => ({
          username: f.username,
          name: f.name,
          image: f.image,
          handle: f.handles[0].handle,
        }));
    }),

  /** Per-contest head-to-head: viewer vs a friend on one finished contest.
   * Thin wrapper over the gated loader (same pattern as compare.verdict). */
  compareOnContest: protectedProcedure
    .input(z.object({ contestId: z.string(), friendUsername: z.string() }))
    .query(({ ctx, input }) =>
      loadContestComparison(ctx.userId, input.contestId, input.friendUsername),
    ),

  /** Per-source pipeline health, for the "stale data" banner. Staleness is
   * computed server-side (against the server clock). */
  getSyncStatus: publicProcedure.query(async ({ ctx }) => {
    const STALE_MS = 90 * 60 * 1000;
    const now = Date.now();
    const rows = await ctx.db.syncState.findMany({ orderBy: { source: "asc" } });
    return rows.map((s) => ({
      source: s.source,
      isStale:
        Boolean(s.lastError) ||
        !s.lastSuccessAt ||
        now - s.lastSuccessAt.getTime() > STALE_MS,
    }));
  }),
});
