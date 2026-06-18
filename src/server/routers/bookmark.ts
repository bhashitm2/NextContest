import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const bookmarkRouter = createTRPCRouter({
  /** All bookmarks for the current user, with their contests, soonest first. */
  getForUser: protectedProcedure.query(({ ctx }) =>
    ctx.db.bookmark.findMany({
      where: { userId: ctx.userId },
      include: { contest: true },
      orderBy: { contest: { startTime: "asc" } },
    }),
  ),

  /** Add or remove a bookmark for a contest (with notification preferences). */
  toggle: protectedProcedure
    .input(
      z.object({
        contestId: z.string(),
        notify24h: z.boolean().optional(),
        notify1h: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const where = {
        userId_contestId: { userId: ctx.userId, contestId: input.contestId },
      };
      const existing = await ctx.db.bookmark.findUnique({ where });

      if (existing) {
        await ctx.db.bookmark.delete({ where: { id: existing.id } });
        return { bookmarked: false };
      }

      await ctx.db.bookmark.create({
        data: {
          userId: ctx.userId,
          contestId: input.contestId,
          notify24h: input.notify24h ?? true,
          notify1h: input.notify1h ?? true,
        },
      });
      return { bookmarked: true };
    }),

  /** Update reminder preferences for an existing bookmark. */
  updatePrefs: protectedProcedure
    .input(
      z.object({
        contestId: z.string(),
        notify24h: z.boolean().optional(),
        notify1h: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.bookmark.update({
        where: { userId_contestId: { userId: ctx.userId, contestId: input.contestId } },
        data: { notify24h: input.notify24h, notify1h: input.notify1h },
      });
      return { ok: true };
    }),
});
