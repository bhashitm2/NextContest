import { randomUUID } from "node:crypto";

import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

/** Build the site's base URL from the actual request, so the feed link always
 * matches the domain the user is on (Vercel, localhost, custom domain) without
 * depending on a NEXT_PUBLIC_APP_URL env var being set correctly. */
function appBaseUrl(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto =
      headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
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

    const base = appBaseUrl(ctx.headers);
    const httpsUrl = `${base}/api/calendar/${user.calendarToken}.ics`;
    // webcal:// triggers a one-click "subscribe" in Apple Calendar / Outlook.
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

    return { httpsUrl, webcalUrl };
  }),
});
