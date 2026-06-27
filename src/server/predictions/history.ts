/**
 * A handle's per-contest rating history — the data behind the handle-first
 * "Rating Lookup" search. Comes from each platform's own per-user history API
 * (one light call, no heavy standings fetch). The latest not-yet-rated contest
 * is predicted separately by the router via the existing predictor.
 */
import { USER_AGENT } from "@/server/sync/types";

import type { PredictablePlatform } from "./types";

export type RatingHistoryEntry = {
  externalId: string;
  contestTitle: string;
  date: Date;
  rank: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  delta: number | null;
  state: "final" | "live";
};

export type RatingHistoryResult =
  | { status: "ok"; entries: RatingHistoryEntry[] }
  | { status: "not-found" }
  | { status: "unavailable" };

// --------------------------------------------------------------------------
// Codeforces — user.rating (every rated contest, with names + old/new rating)
// --------------------------------------------------------------------------

type CfRatingEntry = {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingUpdateTimeSeconds: number;
};
type CfRatingResponse = { status: string; comment?: string; result?: CfRatingEntry[] };

async function codeforcesHistory(handle: string, limit: number): Promise<RatingHistoryResult> {
  let json: CfRatingResponse;
  try {
    const res = await fetch(
      `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
    );
    json = (await res.json()) as CfRatingResponse; // CF returns JSON even on 400
  } catch {
    return { status: "unavailable" };
  }
  if (json.status !== "OK" || !json.result) {
    return /not found/i.test(json.comment ?? "") ? { status: "not-found" } : { status: "unavailable" };
  }
  // CF returns oldest-first; show newest-first.
  const entries = json.result
    .slice()
    .reverse()
    .slice(0, limit)
    .map<RatingHistoryEntry>((e) => ({
      externalId: String(e.contestId),
      contestTitle: e.contestName,
      date: new Date(e.ratingUpdateTimeSeconds * 1000),
      rank: e.rank,
      ratingBefore: e.oldRating,
      ratingAfter: e.newRating,
      delta: e.newRating - e.oldRating,
      state: "final",
    }));
  return { status: "ok", entries };
}

// --------------------------------------------------------------------------
// LeetCode — userContestRankingHistory (attended entries; delta vs previous)
// --------------------------------------------------------------------------

type LcHistoryEntry = {
  attended: boolean;
  rating: number;
  ranking: number;
  contest: { title: string; startTime: number };
};
type LcHistoryResponse = {
  data?: { userContestRankingHistory?: LcHistoryEntry[] | null };
  errors?: { message: string }[];
};

const LC_DEFAULT_RATING = 1500;
const LC_HISTORY_QUERY = `query userContestRankingHistory($username: String!) {
  userContestRankingHistory(username: $username) {
    attended rating ranking
    contest { title startTime }
  }
}`;

async function leetcodeHistory(handle: string, limit: number): Promise<RatingHistoryResult> {
  let json: LcHistoryResponse;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, Referer: "https://leetcode.com" },
      body: JSON.stringify({ query: LC_HISTORY_QUERY, variables: { username: handle } }),
      signal: AbortSignal.timeout(15_000),
    });
    json = (await res.json()) as LcHistoryResponse;
  } catch {
    return { status: "unavailable" };
  }
  if (json.errors?.length) return { status: "unavailable" };
  const history = json.data?.userContestRankingHistory;
  if (history == null) return { status: "not-found" };

  // Chronological (oldest-first): delta = rating - previous attended rating.
  const out: RatingHistoryEntry[] = [];
  let prevRating = LC_DEFAULT_RATING;
  for (const h of history) {
    if (!h.attended) continue;
    const after = Math.round(h.rating);
    out.push({
      externalId: h.contest.title,
      contestTitle: h.contest.title,
      date: new Date(h.contest.startTime * 1000),
      rank: h.ranking,
      ratingBefore: prevRating,
      ratingAfter: after,
      delta: after - prevRating,
      state: "final",
    });
    prevRating = after;
  }
  out.reverse(); // newest-first
  return { status: "ok", entries: out.slice(0, limit) };
}

export function fetchRatingHistory(
  platform: PredictablePlatform,
  handle: string,
  limit: number,
): Promise<RatingHistoryResult> {
  return platform === "CODEFORCES" ? codeforcesHistory(handle, limit) : leetcodeHistory(handle, limit);
}
