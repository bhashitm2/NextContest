import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

/** tRPC request context. `userId` is resolved from the Auth.js session. */
export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  return { db: prisma, userId, headers: opts.headers };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Open to everyone — used for the public contest feed. */
export const publicProcedure = t.procedure;

/** Requires an authenticated user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Throttle a procedure to `max` calls per `windowMs`, keyed by user when
 * signed in, else by client IP. `bucket` isolates limits between procedures. */
export function rateLimited(bucket: string, max: number, windowMs: number) {
  return t.middleware(({ ctx, next }) => {
    const who = ctx.userId ?? `ip:${clientIpFrom(ctx.headers)}`;
    const { ok, retryAfterMs } = checkRateLimit(`${bucket}:${who}`, { max, windowMs });
    if (!ok) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests — try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      });
    }
    return next();
  });
}
