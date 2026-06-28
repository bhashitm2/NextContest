/**
 * Codeforces full-contest leaderboard + problems for the per-contest results
 * page (`/contests/[id]`).
 *
 * Codeforces' `contest.standings` rejects pagination params (from/count → 400),
 * so we fetch the whole standings once (~a few MB, ~1-2s), compute every row's
 * rating change, cache the result in-process, and paginate from memory. Deltas
 * come from the official `contest.ratingChanges` once the round is rated, else
 * from our Carrot predictor (same path the single-handle predictor already uses).
 * The standings response also carries the problem list — so the questions
 * section comes from the same fetch, for free.
 */
import type {
  ContestQuestion,
  ContestQuestionsResult,
  LeaderboardResult,
  LeaderboardRow,
} from "../contest-results";
import {
  fetchRatedMap,
  fetchRatingChanges,
  fetchStandings,
  isRatedRow,
} from "./fetch";
import { Contestant, predict } from "./predict";

type CfFullRow = {
  rank: number;
  handle: string;
  points: number;
  oldRating: number | null;
  delta: number | null;
  newRating: number | null;
};

type CfContestData = {
  /** true → deltas are OFFICIAL (rated), else Carrot predictions. */
  rated: boolean;
  problems: ContestQuestion[];
  /** Ranked rows (official single-person participants only). */
  rows: CfFullRow[];
};

// One full computation serves a burst of leaderboard pages + the questions
// section within the same instance. Re-fetching a 5 MB standings on every page
// flip would be wasteful; a rated contest is immutable, a live one re-settles.
const cache = new Map<string, { at: number; data: CfContestData }>();
const TTL_MS = 10 * 60 * 1000;

async function getCfContestData(contestId: string): Promise<CfContestData | null> {
  const hit = cache.get(contestId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const standings = await fetchStandings(contestId);
  if (!standings) return null;

  const ranked = standings.rows.filter(isRatedRow); // already ordered by rank

  const problems: ContestQuestion[] = (standings.problems ?? []).map((p) => ({
    label: p.index,
    title: p.name,
    points: typeof p.points === "number" ? p.points : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    url: `https://codeforces.com/contest/${encodeURIComponent(contestId)}/problem/${encodeURIComponent(p.index)}`,
  }));

  let rows: CfFullRow[];
  let rated: boolean;

  const official = await fetchRatingChanges(contestId);
  if (official) {
    rated = true;
    const byHandle = new Map(official.map((rc) => [rc.handle.toLowerCase(), rc]));
    rows = ranked.map((row) => {
      const handle = row.party.members[0].handle;
      const rc = byHandle.get(handle.toLowerCase());
      return {
        rank: row.rank,
        handle,
        points: row.points,
        oldRating: rc ? rc.oldRating : null,
        delta: rc ? rc.newRating - rc.oldRating : null,
        newRating: rc ? rc.newRating : null,
      };
    });
  } else {
    rated = false;
    const ratedMap = await fetchRatedMap();
    const contestants = ranked.map(
      (row) =>
        new Contestant(
          row.party.members[0].handle,
          row.points,
          row.penalty,
          ratedMap.get(row.party.members[0].handle.toLowerCase()) ?? null,
        ),
    );
    const predicted = new Map(
      predict(contestants, false).map((r) => [r.handle.toLowerCase(), r]),
    );
    rows = ranked.map((row) => {
      const handle = row.party.members[0].handle;
      const pr = predicted.get(handle.toLowerCase());
      const oldRating = pr?.rating ?? null;
      const delta = pr?.delta ?? null;
      return {
        rank: row.rank,
        handle,
        points: row.points,
        oldRating,
        delta,
        newRating: oldRating != null && delta != null ? oldRating + delta : null,
      };
    });
  }

  const data: CfContestData = { rated, problems, rows };
  cache.set(contestId, { at: Date.now(), data });
  return data;
}

/** One page of a Codeforces contest's ranking (each row with its rating change).
 * `contestId` is the contest's `externalId` (the CF numeric id). Never throws. */
export async function fetchCodeforcesLeaderboard(
  contestId: string,
  page: number,
  size: number,
): Promise<LeaderboardResult> {
  let data: CfContestData | null;
  try {
    data = await getCfContestData(contestId);
  } catch {
    return { status: "unavailable" };
  }
  if (!data) return { status: "unavailable" };

  const start = (page - 1) * size;
  const rows: LeaderboardRow[] = data.rows.slice(start, start + size).map((r) => ({
    rank: r.rank,
    displayName: r.handle,
    profileUrl: `https://codeforces.com/profile/${encodeURIComponent(r.handle)}`,
    oldRating: r.oldRating,
    delta: r.delta,
    newRating: r.newRating,
    score: r.points,
  }));

  return { status: "ok", total: data.rows.length, page, size, rated: data.rated, rows };
}

/** The problems asked in a Codeforces contest (from the standings response). */
export async function fetchCodeforcesProblems(contestId: string): Promise<ContestQuestionsResult> {
  let data: CfContestData | null;
  try {
    data = await getCfContestData(contestId);
  } catch {
    return { status: "unavailable", questions: [] };
  }
  if (!data || data.problems.length === 0) return { status: "unavailable", questions: [] };
  return { status: "ok", questions: data.problems };
}
