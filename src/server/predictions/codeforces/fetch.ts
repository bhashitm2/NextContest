/**
 * Codeforces data fetching for rating prediction.
 *
 * Pulls a contest's standings and resolves every rated participant's pre-contest
 * rating, then runs the FFT predictor. Two paths:
 *  - contest already rated  → use the official deltas from `contest.ratingChanges`
 *    (so the page shows the real number, flagged `rated: true`).
 *  - contest not rated yet  → predict from each participant's CURRENT rating
 *    (`user.ratedList`), exactly like the Carrot extension.
 */
import { fetchJson } from "@/server/sync/types";

import { Contestant, predict } from "./predict";

const API = "https://codeforces.com/api";

export type CfRow = {
  party: {
    members: { handle: string }[];
    participantType: string;
    ghost: boolean;
    teamId?: number;
    teamName?: string;
  };
  rank: number;
  points: number;
  penalty: number;
};
export type CfProblem = {
  index: string;
  name: string;
  points?: number;
  rating?: number;
  tags?: string[];
};
type CfStandingsResponse = {
  status: string;
  result?: {
    contest: { id: number; phase: string; name: string };
    problems: CfProblem[];
    rows: CfRow[];
  };
};

export type CfRatingChange = { handle: string; oldRating: number; newRating: number; rank: number };
type CfRatingChangesResponse = { status: string; result?: CfRatingChange[] };

type CfRatedUser = { handle: string; rating: number };
type CfRatedListResponse = { status: string; result?: CfRatedUser[] };

export type CfPrediction = {
  rank: number | null;
  predictedDelta: number | null;
  currentRating: number | null;
  /** Rating at which the delta would be zero. `null` for rank 1 (infinite). */
  performance: number | null;
};

export type CfContestPredictions = {
  /** true → `byHandle` holds OFFICIAL deltas, not predictions. */
  rated: boolean;
  participantCount: number;
  byHandle: Map<string, CfPrediction>;
};

/** Only single-person CONTESTANT parties (no teams, ghosts, virtual/practice)
 * are rated and thus belong in the prediction. */
export function isRatedRow(row: CfRow): boolean {
  return (
    row.party.participantType === "CONTESTANT" &&
    row.party.members.length === 1 &&
    !row.party.ghost
  );
}

export async function fetchStandings(
  contestId: string,
): Promise<CfStandingsResponse["result"] | null> {
  // Codeforces only allows `contestId` here for non-gym contests/non-admins —
  // any extra param (showUnofficial, handles, from, count) → HTTP 400. The
  // default returns official participants only, which is what we want.
  const json = await fetchJson<CfStandingsResponse>(
    `${API}/contest.standings?contestId=${encodeURIComponent(contestId)}`,
    { timeoutMs: 60_000 },
  );
  if (json.status !== "OK" || !json.result) return null;
  return json.result;
}

/** Official deltas if the contest is rated, else null (treat as "predict"). */
export async function fetchRatingChanges(contestId: string): Promise<CfRatingChange[] | null> {
  try {
    const json = await fetchJson<CfRatingChangesResponse>(
      `${API}/contest.ratingChanges?contestId=${encodeURIComponent(contestId)}`,
    );
    if (json.status === "OK" && json.result && json.result.length > 0) return json.result;
    return null;
  } catch {
    // "Rating changes are unavailable" → HTTP 400 → not rated yet.
    return null;
  }
}

// The rated-user list is multi-MB; cache it briefly so a burst of contests in
// one cron run (or a few public lookups) share a single download.
let ratedCache: { at: number; map: Map<string, number> } | null = null;
const RATED_TTL_MS = 30 * 60 * 1000;

export async function fetchRatedMap(): Promise<Map<string, number>> {
  if (ratedCache && Date.now() - ratedCache.at < RATED_TTL_MS) {
    return ratedCache.map;
  }
  const json = await fetchJson<CfRatedListResponse>(`${API}/user.ratedList?activeOnly=false`, {
    timeoutMs: 90_000,
  });
  const map = new Map<string, number>();
  if (json.status === "OK" && json.result) {
    for (const u of json.result) {
      if (typeof u.rating === "number") map.set(u.handle.toLowerCase(), u.rating);
    }
  }
  ratedCache = { at: Date.now(), map };
  return map;
}

function finite(n: number | null): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

/**
 * Compute predictions (or surface official deltas) for one Codeforces contest.
 * Returns `null` only if the standings couldn't be fetched at all.
 */
export async function predictCodeforcesContest(
  contestId: string,
): Promise<CfContestPredictions | null> {
  const standings = await fetchStandings(contestId);
  if (!standings) return null;

  const rows = standings.rows.filter(isRatedRow);
  const byHandle = new Map<string, CfPrediction>();

  // Already rated → hand back the official numbers.
  const official = await fetchRatingChanges(contestId);
  if (official) {
    for (const rc of official) {
      byHandle.set(rc.handle.toLowerCase(), {
        rank: rc.rank,
        predictedDelta: rc.newRating - rc.oldRating,
        currentRating: rc.oldRating,
        performance: null,
      });
    }
    return { rated: true, participantCount: official.length, byHandle };
  }

  // Not rated yet → predict from current ratings.
  const ratedMap = await fetchRatedMap();
  const contestants = rows.map((row) => {
    const handle = row.party.members[0].handle;
    const rating = ratedMap.get(handle.toLowerCase()) ?? null;
    return new Contestant(handle, row.points, row.penalty, rating);
  });

  const results = predict(contestants, true);
  for (const r of results) {
    byHandle.set(r.handle.toLowerCase(), {
      rank: r.rank,
      predictedDelta: r.delta,
      currentRating: r.rating,
      performance: finite(r.performance),
    });
  }
  return { rated: false, participantCount: contestants.length, byHandle };
}
