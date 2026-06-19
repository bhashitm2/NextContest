import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

/** Runtime check that a string is a real IANA timezone (when the engine can tell). */
function isValidTimeZone(tz: string): boolean {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (supportedValuesOf) return supportedValuesOf("timeZone").includes(tz);
  // Fallback: must construct without throwing.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const userRouter = createTRPCRouter({
  /** Persist the caller's IANA timezone (from the browser) for localized emails. */
  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (!isValidTimeZone(input.timezone)) return { ok: false };
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { timezone: input.timezone },
      });
      return { ok: true };
    }),
});
