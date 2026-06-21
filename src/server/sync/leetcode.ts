import { difficultyFromTitle, fetchJson, type NormalizedContest, pastCutoffMs } from "./types";

type LcContest = {
  title: string;
  titleSlug: string;
  startTime: number; // epoch seconds
  duration: number; // seconds
};

type LcResponse = { data?: { topTwoContests?: LcContest[] }; errors?: { message: string }[] };

const LC_GQL = "https://leetcode.com/graphql";
// topTwoContests returns the next upcoming weekly + biweekly without auth.
const UPCOMING_QUERY = "query { topTwoContests { title titleSlug startTime duration } }";

function toContest(c: LcContest): NormalizedContest {
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
  };
}

// --- past contests (paginated, best-effort) --------------------------------

type LcPastResponse = {
  data?: { pastContests?: { pageNum: number; data: LcContest[] } };
  errors?: { message: string }[];
};
const PAST_QUERY = `query pastContests($pageNo: Int, $numPerPage: Int) {
  pastContests(pageNo: $pageNo, numPerPage: $numPerPage) {
    pageNum
    data { title titleSlug startTime duration }
  }
}`;
const PER_PAGE = 50;
const MAX_PAGES = 6; // safety cap; ~6 months of weekly+biweekly fits in 1

/** Finished contests within the back-fill window, paged newest-first until we
 * cross the cutoff. Best-effort: any failure yields an empty list. */
async function fetchLeetCodePast(): Promise<NormalizedContest[]> {
  const cutoff = pastCutoffMs();
  const out: NormalizedContest[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const json = await fetchJson<LcPastResponse>(LC_GQL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/contest/" },
        body: JSON.stringify({ query: PAST_QUERY, variables: { pageNo: page, numPerPage: PER_PAGE } }),
      });
      const block = json.data?.pastContests;
      const rows = block?.data ?? [];
      if (rows.length === 0) break;

      const fresh = rows.filter((c) => c.startTime * 1000 >= cutoff);
      out.push(...fresh.map(toContest));

      // Page is sorted newest-first; once any row is older than the cutoff (or
      // we've run out of pages), stop.
      if (fresh.length < rows.length) break;
      if (block && page >= block.pageNum) break;
    }
  } catch {
    // best-effort — upcoming still syncs
  }
  return out;
}

/** Upcoming contests plus finished ones within the back-fill window. */
export async function fetchLeetCode(): Promise<NormalizedContest[]> {
  const json = await fetchJson<LcResponse>(LC_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/contest/" },
    body: JSON.stringify({ query: UPCOMING_QUERY }),
  });

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL: ${json.errors[0].message}`);
  }
  const contests = json.data?.topTwoContests;
  if (!contests) {
    throw new Error("LeetCode GraphQL: missing topTwoContests");
  }

  const past = await fetchLeetCodePast();
  return [...contests.map(toContest), ...past];
}
