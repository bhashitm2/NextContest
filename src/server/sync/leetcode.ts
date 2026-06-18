import { difficultyFromTitle, fetchJson, type NormalizedContest } from "./types";

type LcContest = {
  title: string;
  titleSlug: string;
  startTime: number; // epoch seconds
  duration: number; // seconds
};

type LcResponse = { data?: { topTwoContests?: LcContest[] }; errors?: { message: string }[] };

const LC_GQL = "https://leetcode.com/graphql";
// topTwoContests returns the next upcoming weekly + biweekly without auth.
const QUERY = "query { topTwoContests { title titleSlug startTime duration } }";

/** Upcoming contests from LeetCode's (unofficial but stable) GraphQL endpoint. */
export async function fetchLeetCode(): Promise<NormalizedContest[]> {
  const json = await fetchJson<LcResponse>(LC_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/contest/" },
    body: JSON.stringify({ query: QUERY }),
  });

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL: ${json.errors[0].message}`);
  }
  const contests = json.data?.topTwoContests;
  if (!contests) {
    throw new Error("LeetCode GraphQL: missing topTwoContests");
  }

  return contests.map((c) => {
    const startTime = new Date(c.startTime * 1000);
    return {
      platform: "LEETCODE",
      externalId: c.titleSlug,
      title: c.title,
      url: `https://leetcode.com/contest/${c.titleSlug}`,
      startTime,
      endTime: new Date(startTime.getTime() + c.duration * 1000),
      durationSeconds: c.duration,
      difficulty: difficultyFromTitle(c.title),
    } satisfies NormalizedContest;
  });
}
