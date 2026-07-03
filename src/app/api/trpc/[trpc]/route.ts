import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// practice.submit judges synchronously (judge budgets 45s) — Vercel's default
// function timeout would kill it mid-run.
export const maxDuration = 60;

import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });
}

export { handler as GET, handler as POST };
