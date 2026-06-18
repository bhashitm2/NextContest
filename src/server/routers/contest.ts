import { z } from "zod";

import { ContestStatus, Platform } from "@/generated/prisma/client";
import { createTRPCRouter, publicProcedure } from "@/server/trpc";

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
          status: input?.status,
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
