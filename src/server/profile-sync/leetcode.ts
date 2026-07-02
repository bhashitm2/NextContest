import { fetchRatingHistory } from "@/server/predictions/history";

import {
  type ActivityDay,
  fetchJson,
  type ProfileStats,
  RATING_HISTORY_MAX_POINTS,
  type RatingPoint,
  type RecentSolved,
} from "./types";

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
  // GraphQL reports field-level failures (e.g. a private submission calendar)
  // in `errors` while still returning the rest of `data` — only treat errors
  // as fatal when we got no usable user back.
  if (!json.data?.matchedUser) {
    if (json.errors?.length) throw new Error(`LeetCode: ${json.errors[0].message}`);
    throw new Error("LeetCode user not found");
  }
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

  const activity = await fetchActivity(handle);
  const ratingHistory = await contestRatingHistory(handle);

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
      activity,
      ratingHistory,
    },
  };
}

const CALENDAR_QUERY = `query userCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) { activeYears submissionCalendar }
  }
}`;

/** How many years of LeetCode calendars to pull (one GraphQL call per year). */
const MAX_CALENDAR_YEARS = 10;

type LcCalendar = { activeYears?: number[] | null; submissionCalendar?: string | null };

async function fetchCalendar(handle: string, year?: number): Promise<LcCalendar | undefined> {
  const json = await fetchJson<{
    data?: { matchedUser?: { userCalendar?: LcCalendar | null } | null };
  }>(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({
      query: CALENDAR_QUERY,
      variables: year != null ? { username: handle, year } : { username: handle },
    }),
  });
  return json.data?.matchedUser?.userCalendar ?? undefined;
}

/** Parse a submissionCalendar JSON string ({ "<epochSec of UTC day>": count }). */
function parseCalendar(raw: string | null | undefined, into: Map<string, number>): void {
  if (!raw) return;
  const obj = JSON.parse(raw) as Record<string, number>;
  for (const [sec, count] of Object.entries(obj)) {
    if (count <= 0) continue;
    const day = new Date(Number(sec) * 1000).toISOString().slice(0, 10);
    into.set(day, (into.get(day) ?? 0) + count);
  }
}

/** Full submission activity: LeetCode's calendar defaults to the trailing ~12
 * months, but takes a `year` argument and reports `activeYears` — so fetch
 * each active year for the complete history. Fetched separately from the main
 * profile query: users can make their calendar private, which nulls out the
 * WHOLE matchedUser of any query that includes userCalendar — bundling it
 * would break the entire stats sync for those users. */
async function fetchActivity(handle: string): Promise<ActivityDay[] | undefined> {
  const merged = new Map<string, number>();
  let years: number[];
  try {
    const first = await fetchCalendar(handle);
    if (!first) return undefined;
    years = (first.activeYears ?? []).slice(-MAX_CALENDAR_YEARS);
    // No per-year data to fetch — fall back to the default trailing window.
    if (years.length === 0) {
      parseCalendar(first.submissionCalendar, merged);
    }
  } catch {
    return undefined;
  }
  for (const year of years) {
    try {
      const cal = await fetchCalendar(handle, year);
      parseCalendar(cal?.submissionCalendar, merged);
    } catch {
      // best-effort: a failed year just leaves a gap
    }
  }
  if (merged.size === 0) return undefined;
  return [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

/** Contest rating timeline via the shared per-user history fetcher (best-effort). */
async function contestRatingHistory(handle: string): Promise<RatingPoint[] | undefined> {
  try {
    const result = await fetchRatingHistory("LEETCODE", handle, RATING_HISTORY_MAX_POINTS);
    if (result.status !== "ok" || result.entries.length === 0) return undefined;
    // Entries come newest-first; the timeline wants chronological order.
    return result.entries
      .slice()
      .reverse()
      .filter((e) => e.ratingAfter != null)
      .map((e) => ({
        at: e.date.toISOString(),
        rating: e.ratingAfter as number,
        delta: e.delta,
        rank: e.rank,
      }));
  } catch {
    return undefined;
  }
}
