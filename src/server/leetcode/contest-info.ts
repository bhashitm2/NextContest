/**
 * LeetCode contest metadata — the list of questions asked in a contest.
 *
 * The lccn-predictor service has no questions endpoint, and LeetCode's REST
 * contest-info endpoint (`/contest/api/info/{slug}/`) is Cloudflare-protected
 * (403 to server requests). Its GraphQL API, however, answers the
 * `contestQuestionList` query unauthenticated — the same endpoint we already use
 * for `userContestRankingHistory` in `profile-sync/contest-perf.ts`.
 *
 *   query contestQuestionList($contestSlug: String!) {
 *     contestQuestionList(contestSlug: $contestSlug) { title titleSlug credit questionId }
 *   }
 *
 * Best-effort: any failure (network, shape change) degrades to `unavailable`
 * with an empty list so the page simply omits the section.
 */
import { fetchJson } from "@/server/sync/types";

/** One contest problem, normalized for the UI. */
export type ContestQuestion = {
  id: number | null;
  title: string;
  slug: string;
  /** Points the problem is worth in the contest. */
  credit: number | null;
  url: string;
};

export type ContestQuestionsResult = {
  status: "ok" | "unavailable";
  questions: ContestQuestion[];
};

type LcQuestionNode = {
  title?: string;
  titleSlug?: string;
  credit?: number;
  questionId?: string | number;
};
type LcQuestionsResponse = {
  data?: { contestQuestionList?: LcQuestionNode[] };
  errors?: { message: string }[];
};

const QUESTIONS_QUERY = `query contestQuestionList($contestSlug: String!) {
  contestQuestionList(contestSlug: $contestSlug) {
    title
    titleSlug
    credit
    questionId
  }
}`;

/** Fetch the problems for a LeetCode contest by slug (its `externalId`). */
export async function fetchLeetCodeQuestions(slug: string): Promise<ContestQuestionsResult> {
  try {
    const json = await fetchJson<LcQuestionsResponse>("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
      body: JSON.stringify({ query: QUESTIONS_QUERY, variables: { contestSlug: slug } }),
      timeoutMs: 15_000,
    });
    if (json.errors?.length) return { status: "unavailable", questions: [] };

    const list = json.data?.contestQuestionList;
    if (!Array.isArray(list) || list.length === 0) return { status: "unavailable", questions: [] };

    const questions: ContestQuestion[] = list
      .filter((q) => q.titleSlug)
      .map((q) => ({
        id: q.questionId != null ? Number(q.questionId) || null : null,
        title: q.title ?? q.titleSlug!,
        slug: q.titleSlug!,
        credit: q.credit ?? null,
        url: `https://leetcode.com/problems/${q.titleSlug}/`,
      }));

    return questions.length > 0
      ? { status: "ok", questions }
      : { status: "unavailable", questions: [] };
  } catch {
    return { status: "unavailable", questions: [] };
  }
}
