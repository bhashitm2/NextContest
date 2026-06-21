import * as cheerio from "cheerio";

import type { ContestPerformance } from "@/lib/contest-compare";

import type { ProfilePlatform } from "./types";
import { fetchJson, USER_AGENT } from "./types";

/**
 * One user's performance on ONE contest, as a discriminated result so callers
 * can tell apart "didn't enter", "results not rated yet", and "fetch failed":
 * - `ok`                → participated and rated; `perf` is populated.
 * - `not-participated`  → confirmed absent from the user's contest history.
 * - `pending`           → contest just ended; rating not applied yet, re-check later.
 * - `unavailable`       → network/scrape failure (never throws).
 */
export type ContestPerfResult =
  | { state: "ok"; perf: ContestPerformance }
  | { state: "not-participated" }
  | { state: "pending" }
  | { state: "unavailable" };

/** The stored contest, enough to match against each platform's history. */
export type ContestRef = { externalId: string; startTime: Date; endTime: Date };

const RECENT_MS = 24 * 60 * 60 * 1000;

/** A finished contest whose results may simply not be published yet. */
function endedRecently(ref: ContestRef): boolean {
  const end = ref.endTime.getTime();
  return end <= Date.now() && Date.now() - end < RECENT_MS;
}

/** No matching history entry → pending if the contest just ended, else absent. */
function absent(ref: ContestRef): ContestPerfResult {
  return endedRecently(ref) ? { state: "pending" } : { state: "not-participated" };
}

// --------------------------------------------------------------------------
// Codeforces — official user.rating (per-contest rank + rating change)
// --------------------------------------------------------------------------

type CfRatingEntry = {
  contestId: number;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingUpdateTimeSeconds: number;
};
type CfRatingResponse = { status: string; result?: CfRatingEntry[] };

/** Pure: find the user's record for `externalId` in their CF rating history. */
export function parseCodeforcesPerf(
  entries: CfRatingEntry[],
  ref: ContestRef,
): ContestPerfResult {
  const e = entries.find((x) => String(x.contestId) === ref.externalId);
  if (!e) return absent(ref);
  return {
    state: "ok",
    perf: {
      participated: true,
      rank: e.rank,
      ratingBefore: e.oldRating,
      ratingAfter: e.newRating,
      ratingDelta: e.newRating - e.oldRating,
      problemsSolved: null, // not in this endpoint
      performance: null,
    },
  };
}

async function fetchCodeforcesPerf(handle: string, ref: ContestRef): Promise<ContestPerfResult> {
  const json = await fetchJson<CfRatingResponse>(
    `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`,
  );
  if (json.status !== "OK") return { state: "unavailable" };
  return parseCodeforcesPerf(json.result ?? [], ref);
}

// --------------------------------------------------------------------------
// AtCoder — official users/<h>/history/json
// --------------------------------------------------------------------------

type AcHistoryEntry = {
  IsRated: boolean;
  Place: number;
  OldRating: number;
  NewRating: number;
  Performance: number;
  ContestScreenName: string; // e.g. "abc086.contest.atcoder.jp" OR "abc086"
};

/** AtCoder's `ContestScreenName` is sometimes a full host ("abc086.contest…");
 * reduce it to the bare contest key that matches our stored externalId. */
function acContestKey(screenName: string): string {
  return screenName.split(".")[0];
}

/** Pure: find the user's record for `externalId` in their AtCoder history. */
export function parseAtCoderPerf(
  entries: AcHistoryEntry[],
  ref: ContestRef,
): ContestPerfResult {
  const e = entries.find((x) => acContestKey(x.ContestScreenName) === ref.externalId);
  if (!e) return absent(ref);
  return {
    state: "ok",
    perf: {
      participated: true,
      rank: e.Place,
      ratingBefore: e.IsRated ? e.OldRating : null,
      ratingAfter: e.IsRated ? e.NewRating : null,
      ratingDelta: e.IsRated ? e.NewRating - e.OldRating : null,
      problemsSolved: null,
      performance: typeof e.Performance === "number" ? e.Performance : null,
    },
  };
}

async function fetchAtCoderPerf(handle: string, ref: ContestRef): Promise<ContestPerfResult> {
  const arr = await fetchJson<AcHistoryEntry[]>(
    `https://atcoder.jp/users/${encodeURIComponent(handle)}/history/json`,
  );
  if (!Array.isArray(arr)) return { state: "unavailable" };
  return parseAtCoderPerf(arr, ref);
}

// --------------------------------------------------------------------------
// LeetCode — userContestRankingHistory (title has no slug → slugify + time match)
// --------------------------------------------------------------------------

type LcHistoryEntry = {
  attended: boolean;
  rating: number;
  ranking: number;
  problemsSolved: number;
  totalProblems: number;
  contest: { title: string; startTime: number }; // startTime = epoch seconds
};
type LcHistoryResponse = {
  data?: { userContestRankingHistory?: LcHistoryEntry[] };
  errors?: { message: string }[];
};

const LC_DEFAULT_RATING = 1500;

/** "Weekly Contest 507" → "weekly-contest-507" (matches LeetCode titleSlug). */
export function slugifyContestTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pure: match the contest by slugified title (fallback: startTime ±2 min) and
 * compute the rating delta from the previous *attended* entry. */
export function parseLeetCodePerf(
  history: LcHistoryEntry[],
  ref: ContestRef,
): ContestPerfResult {
  const targetSec = Math.floor(ref.startTime.getTime() / 1000);
  const idx = history.findIndex(
    (h) =>
      slugifyContestTitle(h.contest.title) === ref.externalId ||
      Math.abs(h.contest.startTime - targetSec) <= 120,
  );
  if (idx === -1) return absent(ref);

  const entry = history[idx];
  if (!entry.attended) return { state: "not-participated" };

  // Previous attended contest's rating = rating going IN to this one.
  let ratingBefore = LC_DEFAULT_RATING;
  for (let i = idx - 1; i >= 0; i--) {
    if (history[i].attended) {
      ratingBefore = Math.round(history[i].rating);
      break;
    }
  }
  const ratingAfter = Math.round(entry.rating);
  return {
    state: "ok",
    perf: {
      participated: true,
      rank: entry.ranking,
      ratingBefore,
      ratingAfter,
      ratingDelta: ratingAfter - ratingBefore,
      problemsSolved: entry.problemsSolved,
      performance: null,
    },
  };
}

const LC_HISTORY_QUERY = `query userContestRankingHistory($username: String!) {
  userContestRankingHistory(username: $username) {
    attended rating ranking problemsSolved totalProblems
    contest { title startTime }
  }
}`;

async function fetchLeetCodePerf(handle: string, ref: ContestRef): Promise<ContestPerfResult> {
  const json = await fetchJson<LcHistoryResponse>("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query: LC_HISTORY_QUERY, variables: { username: handle } }),
  });
  if (json.errors?.length) return { state: "unavailable" };
  const history = json.data?.userContestRankingHistory;
  if (!Array.isArray(history)) return { state: "unavailable" };
  return parseLeetCodePerf(history, ref);
}

// --------------------------------------------------------------------------
// CodeChef — scrape the profile's embedded `all_rating` history array
// --------------------------------------------------------------------------

type CcRatingEntry = { code?: string; rating?: string | number; rank?: string | number };

function num(v: string | number | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

/** Pure: parse the `all_rating` JSON and pull the entry for `externalId`.
 * The array is chronological, so rating-before = the previous entry's rating. */
export function parseCodeChefPerf(allRatingJson: string, ref: ContestRef): ContestPerfResult {
  let arr: CcRatingEntry[];
  try {
    arr = JSON.parse(allRatingJson) as CcRatingEntry[];
  } catch {
    return { state: "unavailable" };
  }
  if (!Array.isArray(arr)) return { state: "unavailable" };

  const idx = arr.findIndex((e) => e.code === ref.externalId);
  if (idx === -1) return absent(ref);

  const ratingAfter = num(arr[idx].rating);
  const ratingBefore = idx > 0 ? num(arr[idx - 1].rating) : null;
  return {
    state: "ok",
    perf: {
      participated: true,
      rank: num(arr[idx].rank),
      ratingBefore,
      ratingAfter,
      ratingDelta: ratingAfter !== null && ratingBefore !== null ? ratingAfter - ratingBefore : null,
      problemsSolved: null,
      performance: null,
    },
  };
}

async function fetchCodeChefPerf(handle: string, ref: ContestRef): Promise<ContestPerfResult> {
  const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { state: "unavailable" };
  const html = await res.text();
  const $ = cheerio.load(html);
  const m = $.html().match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return { state: "unavailable" };
  return parseCodeChefPerf(m[1], ref);
}

// --------------------------------------------------------------------------
// Dispatcher — one platform's outage can't 500 the request.
// --------------------------------------------------------------------------

const FETCHERS: Record<
  ProfilePlatform,
  (handle: string, ref: ContestRef) => Promise<ContestPerfResult>
> = {
  CODEFORCES: fetchCodeforcesPerf,
  ATCODER: fetchAtCoderPerf,
  LEETCODE: fetchLeetCodePerf,
  CODECHEF: fetchCodeChefPerf,
};

/** Fetch one user's performance on one contest. Returns a discriminated result;
 * any thrown error degrades to `unavailable` so the comparison never crashes. */
export async function fetchContestPerformance(
  platform: ProfilePlatform,
  handle: string,
  ref: ContestRef,
): Promise<ContestPerfResult> {
  try {
    return await FETCHERS[platform](handle, ref);
  } catch {
    return { state: "unavailable" };
  }
}
