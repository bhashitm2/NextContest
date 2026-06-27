/**
 * LeetCode rating prediction.
 *
 * Primary source: a self-hosted lccn-predictor service (the bhashitm2/lccn-predictor
 * fork) reached via the `LCCN_PREDICTOR_URL` env var
 * (e.g. https://lccn-predictor.onrender.com). LeetCode publishes official ratings
 * only ~a day after a contest, so this service is what lets us show a predicted
 * delta minutes after it ends. It's opt-in: with no URL set (or if the service
 * is down / hasn't predicted the contest yet) we fall back to LeetCode's OFFICIAL
 * rating change once the platform publishes it — the same number, just later.
 * Either way the page never breaks.
 *
 * API used: GET {base}/api/v1/contest/{slug}/user/{username}
 *   reply (PredictionRecord): { rank, old_rating, delta_rating, new_rating, … }
 *   404 → contest not predicted yet / user didn't compete → fall back.
 */
import {
  type ContestPerfResult,
  type ContestRef,
  fetchContestPerformance,
} from "@/server/profile-sync/contest-perf";

import type { ContestLike, ContestPrediction } from "../types";

function project(currentRating: number | null, delta: number | null): number | null {
  return currentRating != null && delta != null ? currentRating + delta : null;
}

/** Map the existing official-result fetch into a prediction view (final/late). */
function fromOfficial(handle: string, r: ContestPerfResult): ContestPrediction {
  const base = {
    platform: "LEETCODE" as const,
    handle,
    rank: null,
    predictedDelta: null,
    currentRating: null,
    projectedRating: null,
    performance: null,
    computedAt: null,
  };
  if (r.state === "ok") {
    return {
      ...base,
      state: "final",
      rank: r.perf.rank,
      predictedDelta: r.perf.ratingDelta,
      currentRating: r.perf.ratingBefore,
      projectedRating: r.perf.ratingAfter ?? project(r.perf.ratingBefore, r.perf.ratingDelta),
      computedAt: new Date(),
    };
  }
  if (r.state === "pending") return { ...base, state: "pending" };
  if (r.state === "not-participated") return { ...base, state: "not-participated" };
  return { ...base, state: "unavailable" };
}

type PredictionRecord = {
  rank?: number | null;
  old_rating?: number | null;
  delta_rating?: number | null;
  new_rating?: number | null;
};

/** Query the self-hosted lccn-predictor, if configured. Returns null on any
 * problem (no URL, service down/cold, contest not predicted yet → 404, or no
 * delta) so the caller falls back to the official rating. Our LeetCode
 * `externalId` IS the contest slug (e.g. "weekly-contest-507"). */
async function queryLccn(contest: ContestLike, handle: string): Promise<ContestPrediction | null> {
  const base = process.env.LCCN_PREDICTOR_URL;
  if (!base) return null;
  const url =
    `${base.replace(/\/$/, "")}/api/v1/contest/${encodeURIComponent(contest.externalId)}` +
    `/user/${encodeURIComponent(handle)}`;
  try {
    // Generous timeout: a free-tier host may cold-start (~1 min) on first hit.
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null; // 404 = contest not predicted yet / user not in it
    const rec = (await res.json()) as PredictionRecord;
    if (rec.delta_rating == null) return null;

    const delta = Math.round(rec.delta_rating);
    const oldRating = rec.old_rating != null ? Math.round(rec.old_rating) : null;
    const newRating = rec.new_rating != null ? Math.round(rec.new_rating) : null;
    return {
      state: "live",
      platform: "LEETCODE",
      handle,
      rank: rec.rank ?? null,
      predictedDelta: delta,
      currentRating: oldRating,
      projectedRating: newRating ?? project(oldRating, delta),
      performance: null,
      computedAt: new Date(),
    };
  } catch {
    return null;
  }
}

export async function fetchLeetCodePrediction(
  contest: ContestLike,
  handle: string,
): Promise<ContestPrediction> {
  const live = await queryLccn(contest, handle);
  if (live) return live;

  // Fallback: official rating change (shown once LeetCode publishes it).
  const ref: ContestRef = {
    externalId: contest.externalId,
    startTime: contest.startTime,
    endTime: contest.endTime,
  };
  const official = await fetchContestPerformance("LEETCODE", handle, ref);
  return fromOfficial(handle, official);
}
