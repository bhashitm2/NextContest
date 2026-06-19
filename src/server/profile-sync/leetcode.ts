import { fetchJson, type ProfileStats, type RecentSolved } from "./types";

const GQL = "https://leetcode.com/graphql";

type AcNum = { difficulty: string; count: number };
type TagCountNode = { tagName: string; problemsSolved: number };
type LcData = {
  matchedUser: {
    profile: { ranking?: number; aboutMe?: string; realName?: string } | null;
    submitStats: { acSubmissionNum: AcNum[] } | null;
    tagProblemCounts: {
      advanced: TagCountNode[];
      intermediate: TagCountNode[];
      fundamental: TagCountNode[];
    } | null;
  } | null;
  recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string }[] | null;
  userContestRanking: {
    rating?: number;
    attendedContestsCount?: number;
    badge?: { name: string } | null;
  } | null;
};
type LcResponse = { data?: LcData; errors?: { message: string }[] };

const QUERY = `query userProfile($username: String!) {
  matchedUser(username: $username) {
    profile { ranking aboutMe realName }
    submitStats { acSubmissionNum { difficulty count } }
    tagProblemCounts {
      advanced { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      fundamental { tagName problemsSolved }
    }
  }
  recentAcSubmissionList(username: $username, limit: 12) { title titleSlug timestamp }
  userContestRanking(username: $username) { rating attendedContestsCount badge { name } }
}`;

async function query(username: string): Promise<LcData> {
  const json = await fetchJson<LcResponse>(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
  });
  if (json.errors?.length) throw new Error(`LeetCode: ${json.errors[0].message}`);
  if (!json.data?.matchedUser) throw new Error("LeetCode user not found");
  return json.data;
}

/** Confirm the handle exists. Returns the handle unchanged. */
export async function validateLeetCode(handle: string): Promise<string> {
  await query(handle);
  return handle;
}

/** Text to scan for the verification token (LeetCode Summary / realName). */
export async function fetchLeetCodeVerificationField(handle: string): Promise<string> {
  const data = await query(handle);
  return [data.matchedUser?.profile?.aboutMe, data.matchedUser?.profile?.realName]
    .filter(Boolean)
    .join(" ");
}

/** Full per-user stats from LeetCode's GraphQL endpoint. */
export async function fetchLeetCodeStats(handle: string): Promise<ProfileStats> {
  const data = await query(handle);
  const ac = data.matchedUser?.submitStats?.acSubmissionNum ?? [];
  const byDiff = (d: string) => ac.find((a) => a.difficulty === d)?.count ?? 0;

  const recentSolved: RecentSolved[] = (data.recentAcSubmissionList ?? []).slice(0, 10).map((s) => ({
    title: s.title,
    url: `https://leetcode.com/problems/${s.titleSlug}/`,
    at: new Date(Number(s.timestamp) * 1000).toISOString(),
  }));

  const tpc = data.matchedUser?.tagProblemCounts;
  const tags = [...(tpc?.fundamental ?? []), ...(tpc?.intermediate ?? []), ...(tpc?.advanced ?? [])]
    .filter((t) => t.problemsSolved > 0)
    .map((t) => ({ tag: t.tagName, count: t.problemsSolved }));

  const ucr = data.userContestRanking;
  const contestRating = ucr?.rating;
  // LeetCode contest "badge": Knight / Guardian, else None once they've competed.
  const rank = ucr ? (ucr.badge?.name ?? "None") : null;

  return {
    rating: contestRating ? Math.round(contestRating) : null,
    maxRating: null, // LeetCode doesn't expose peak contest rating
    rank,
    problemsSolved: byDiff("All"),
    extra: {
      difficulty: { easy: byDiff("Easy"), medium: byDiff("Medium"), hard: byDiff("Hard") },
      contests: data.userContestRanking?.attendedContestsCount,
      recentSolved,
      tags,
    },
  };
}
