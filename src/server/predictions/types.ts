import type { Platform } from "@/generated/prisma/client";

/** Platforms with a live contest-rating predictor + rating history. */
export type PredictablePlatform = "CODEFORCES" | "LEETCODE";

/**
 * State of a single handle's prediction on a contest:
 *  - `live`             → predicted from current ratings, not yet official.
 *  - `final`            → contest is officially rated; the delta is the real one.
 *  - `pending`          → contest ongoing / just ended; result not resolvable yet.
 *  - `not-participated` → handle isn't in the rated standings.
 *  - `unavailable`      → platform unsupported or fetch failed.
 */
export type PredictionState = "live" | "final" | "pending" | "not-participated" | "unavailable";

/** One handle's prediction on one contest, as consumed by the router / UI. */
export type ContestPrediction = {
  state: PredictionState;
  platform: Platform;
  handle: string;
  rank: number | null;
  predictedDelta: number | null;
  currentRating: number | null;
  projectedRating: number | null;
  /** CF only: rating at which the delta would be zero. */
  performance: number | null;
  computedAt: Date | null;
};

/** A contest reduced to what the predictor needs. */
export type ContestLike = {
  platform: Platform;
  externalId: string;
  startTime: Date;
  endTime: Date;
};
