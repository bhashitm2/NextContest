import { randomUUID } from "node:crypto";

import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const calendarRouter = createTRPCRouter({
  /** The current user's personal calendar-subscription URLs. Mints a secret
   * token on first call (lazy), then returns it stably afterwards. */
  subscription: protectedProcedure.query(async ({ ctx }) => {
    let user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { calendarToken: true },
    });

    if (!user?.calendarToken) {
      user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { calendarToken: randomUUID() },
        select: { calendarToken: true },
      });
    }

    const base = appBaseUrl();
    const httpsUrl = `${base}/api/calendar/${user.calendarToken}.ics`;
    // webcal:// triggers a one-click "subscribe" in Apple Calendar / Outlook.
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

    return { httpsUrl, webcalUrl };
  }),
});
