import { z } from "zod";

import { Platform } from "@/generated/prisma/client";
import { ensureAutoBookmarks, removeAutoBookmarks } from "@/server/sync/auto-bookmarks";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const subscriptionRouter = createTRPCRouter({
  /** Platforms the current user follows (auto-reminders on). */
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.platformSubscription.findMany({ where: { userId: ctx.userId } }),
  ),

  /** Follow / unfollow a platform. Following auto-bookmarks all its upcoming
   * contests; unfollowing removes those auto-bookmarks (manual ones stay). */
  toggle: protectedProcedure
    .input(z.object({ platform: z.enum(Platform) }))
    .mutation(async ({ ctx, input }) => {
      const where = {
        userId_platform: { userId: ctx.userId, platform: input.platform },
      };
      const existing = await ctx.db.platformSubscription.findUnique({ where });

      if (existing) {
        await ctx.db.platformSubscription.delete({ where: { id: existing.id } });
        await removeAutoBookmarks(ctx.userId, input.platform);
        return { subscribed: false };
      }

      const sub = await ctx.db.platformSubscription.create({
        data: { userId: ctx.userId, platform: input.platform },
      });
      await ensureAutoBookmarks(ctx.userId, input.platform, {
        notify24h: sub.notify24h,
        notify1h: sub.notify1h,
      });
      return { subscribed: true };
    }),
});
