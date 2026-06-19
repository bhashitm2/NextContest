import { createCallerFactory, createTRPCRouter } from "@/server/trpc";

import { bookmarkRouter } from "./bookmark";
import { calendarRouter } from "./calendar";
import { contestRouter } from "./contest";
import { friendRouter } from "./friend";
import { handleRouter } from "./handle";
import { subscriptionRouter } from "./subscription";
import { userRouter } from "./user";

export const appRouter = createTRPCRouter({
  contest: contestRouter,
  bookmark: bookmarkRouter,
  subscription: subscriptionRouter,
  calendar: calendarRouter,
  handle: handleRouter,
  user: userRouter,
  friend: friendRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller, for use in Server Components / background jobs. */
export const createCaller = createCallerFactory(appRouter);
