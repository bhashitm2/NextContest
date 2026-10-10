import { cache } from "react";

import type { Platform } from "@/generated/prisma/client";
import { fetchLeetCodeQuestions } from "@/server/leetcode/contest-info";
import { fetchCodeforcesProblems } from "@/server/predictions/codeforces/leaderboard";
import type { ContestQuestionsResult } from "@/server/predictions/contest-results";

const UNAVAILABLE: ContestQuestionsResult = { status: "unavailable", questions: [] };

/**
 * Contest questions for a server-rendered page.
 *
 * Deliberately bypasses `rating.contestQuestions`: that procedure carries a
 * per-IP rate limit, and a server render builds its tRPC caller with empty
 * headers, so every signed-out render shared the bucket key "ip:unknown" — a
 * site-wide cap of 12 contest pages per minute, after which the page threw and
 * returned a 500. The limiter is there to stop client abuse of the upstream
 * APIs; our own SSR is not that threat.
 *
 * Failures degrade to an omitted section rather than failing the page, and
 * `cache` dedupes the call within a single request.
 */
export const contestQuestions = cache(
  async (platform: Platform, externalId: string): Promise<ContestQuestionsResult> => {
    try {
      if (platform === "LEETCODE") return await fetchLeetCodeQuestions(externalId);
      if (platform === "CODEFORCES") return await fetchCodeforcesProblems(externalId);
    } catch {
      return UNAVAILABLE;
    }
    return UNAVAILABLE;
  },
);
