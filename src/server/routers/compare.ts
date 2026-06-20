import { z } from "zod";

import { fallbackVerdict, generateVerdict, statsHash } from "@/server/ai/verdict";
import { loadComparison } from "@/server/compare/load";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

const VERDICT_TTL_MS = 24 * 60 * 60 * 1000;

export const compareRouter = createTRPCRouter({
  /**
   * AI verdict for a head-to-head (friend-gated). Served from cache when fresh;
   * otherwise calls Gemini and caches the result. Falls back to a deterministic
   * one-liner if the AI is unavailable — never throws on AI failure.
   */
  verdict: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const outcome = await loadComparison(ctx.userId, input.username);
      if (outcome.status !== "ok" || !outcome.comparison.hasData) {
        return { verdict: null, source: "none" as const };
      }

      const { result, viewerId, targetId } = outcome.comparison;
      const pairKey = [viewerId, targetId].sort().join(":");
      const hash = statsHash(result);

      const cached = await ctx.db.comparisonVerdict.findUnique({ where: { pairKey } });
      if (
        cached &&
        cached.statsHash === hash &&
        Date.now() - cached.updatedAt.getTime() < VERDICT_TTL_MS
      ) {
        return { verdict: cached.verdict, source: "ai" as const };
      }

      const ai = await generateVerdict(result);
      if (ai) {
        await ctx.db.comparisonVerdict.upsert({
          where: { pairKey },
          create: { pairKey, statsHash: hash, verdict: ai },
          update: { statsHash: hash, verdict: ai },
        });
        return { verdict: ai, source: "ai" as const };
      }

      return { verdict: fallbackVerdict(result), source: "fallback" as const };
    }),
});
