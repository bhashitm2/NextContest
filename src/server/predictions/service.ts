/**
 * Prediction service: cache-first reads + compute-and-store, shared by the
 * `rating` tRPC router (personal page + public lookup) and the predictions cron.
 * Mirrors the cache-first design of `server/compare/load-contest.ts`.
 */
import type { Platform } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { type CfContestPredictions, type CfPrediction, predictCodeforcesContest } from "./codeforces/fetch";
import { fetchLeetCodePrediction } from "./leetcode/fetch";
import type { ContestLike, ContestPrediction, PredictionState } from "./types";

const RECENT_MS = 24 * 60 * 60 * 1000;
/** Re-predict a still-live contest at most this often. */
const LIVE_TTL_MS = 10 * 60 * 1000;

/** Contest is still running or only just ended — a missing result is "pending". */
function ongoingOrRecent(c: ContestLike): boolean {
  const end = c.endTime.getTime();
  return Date.now() < end || Date.now() - end < RECENT_MS;
}

function absentState(c: ContestLike): PredictionState {
  return ongoingOrRecent(c) ? "pending" : "not-participated";
}

function bare(platform: Platform, handle: string, state: PredictionState): ContestPrediction {
  return {
    state,
    platform,
    handle,
    rank: null,
    predictedDelta: null,
    currentRating: null,
    projectedRating: null,
    performance: null,
    computedAt: null,
  };
}

function project(currentRating: number | null, delta: number | null): number | null {
  return currentRating != null && delta != null ? currentRating + delta : null;
}

// --------------------------------------------------------------------------
// Codeforces
// --------------------------------------------------------------------------

// In-process cache of a full CF contest computation (one fetch serves a burst of
// handle lookups within the same worker/serverless instance).
const cfCache = new Map<string, { at: number; preds: CfContestPredictions }>();
const CF_CACHE_TTL = 5 * 60 * 1000;

async function computeCfContest(externalId: string): Promise<CfContestPredictions | null> {
  const hit = cfCache.get(externalId);
  if (hit && Date.now() - hit.at < CF_CACHE_TTL) return hit.preds;
  const preds = await predictCodeforcesContest(externalId);
  if (preds) cfCache.set(externalId, { at: Date.now(), preds });
  return preds;
}

function cfRowToView(
  handle: string,
  row: CfPrediction,
  rated: boolean,
  computedAt: Date,
): ContestPrediction {
  return {
    state: rated ? "final" : "live",
    platform: "CODEFORCES",
    handle,
    rank: row.rank,
    predictedDelta: row.predictedDelta,
    currentRating: row.currentRating,
    projectedRating: project(row.currentRating, row.predictedDelta),
    performance: row.performance,
    computedAt,
  };
}

async function storeCfRow(
  externalId: string,
  key: string,
  row: CfPrediction,
  rated: boolean,
): Promise<void> {
  const data = {
    rank: row.rank,
    predictedDelta: row.predictedDelta,
    currentRating: row.currentRating,
    performance: row.performance,
    state: rated ? "final" : "live",
    computedAt: new Date(),
  };
  try {
    await prisma.ratingPrediction.upsert({
      where: { platform_externalId_handle: { platform: "CODEFORCES", externalId, handle: key } },
      create: { platform: "CODEFORCES", externalId, handle: key, ...data },
      update: data,
    });
  } catch {
    // best-effort cache; a missing table (pre-migration) must not break reads
  }
}

async function recordRun(
  platform: Platform,
  externalId: string,
  rated: boolean,
  participantCount: number,
  ok: boolean,
): Promise<void> {
  try {
    await prisma.predictionRun.upsert({
      where: { platform_externalId: { platform, externalId } },
      create: { platform, externalId, rated, participantCount, ok, computedAt: new Date() },
      update: { rated, participantCount, ok, computedAt: new Date() },
    });
  } catch {
    // ignore
  }
}

async function getCfPrediction(contest: ContestLike, handle: string): Promise<ContestPrediction> {
  const key = handle.toLowerCase();
  const { externalId } = contest;

  // 1. Cache: a final result is immutable; a fresh live one is good enough.
  try {
    const cached = await prisma.ratingPrediction.findUnique({
      where: { platform_externalId_handle: { platform: "CODEFORCES", externalId, handle: key } },
    });
    if (cached) {
      const fresh = Date.now() - cached.computedAt.getTime() < LIVE_TTL_MS;
      if (cached.state === "final" || (cached.state === "live" && fresh)) {
        return {
          state: cached.state as PredictionState,
          platform: "CODEFORCES",
          handle,
          rank: cached.rank,
          predictedDelta: cached.predictedDelta,
          currentRating: cached.currentRating,
          projectedRating: project(cached.currentRating, cached.predictedDelta),
          performance: cached.performance,
          computedAt: cached.computedAt,
        };
      }
    }
  } catch {
    // cache unavailable — fall through to live compute
  }

  // 2. Compute the whole contest (cached in-process), then store this handle.
  const preds = await computeCfContest(externalId);
  if (!preds) return bare("CODEFORCES", handle, ongoingOrRecent(contest) ? "pending" : "unavailable");

  await recordRun("CODEFORCES", externalId, preds.rated, preds.participantCount, true);

  const row = preds.byHandle.get(key);
  if (!row) return bare("CODEFORCES", handle, absentState(contest));

  await storeCfRow(externalId, key, row, preds.rated);
  return cfRowToView(handle, row, preds.rated, new Date());
}

/** Cron path: compute one CF contest once and persist rows for many handles. */
export async function refreshCodeforcesContest(
  contest: ContestLike,
  handles: string[],
): Promise<{ rated: boolean; stored: number } | null> {
  const preds = await computeCfContest(contest.externalId);
  if (!preds) return null;
  await recordRun("CODEFORCES", contest.externalId, preds.rated, preds.participantCount, true);

  let stored = 0;
  for (const h of handles) {
    const key = h.toLowerCase();
    const row = preds.byHandle.get(key);
    if (row) {
      await storeCfRow(contest.externalId, key, row, preds.rated);
      stored++;
    }
  }
  return { rated: preds.rated, stored };
}

// --------------------------------------------------------------------------
// LeetCode (Phase 4 — backed by the self-hosted lccn_predictor service)
// --------------------------------------------------------------------------

async function getLcPrediction(contest: ContestLike, handle: string): Promise<ContestPrediction> {
  const key = handle.toLowerCase();
  try {
    const cached = await prisma.ratingPrediction.findUnique({
      where: { platform_externalId_handle: { platform: "LEETCODE", externalId: contest.externalId, handle: key } },
    });
    if (cached && (cached.state === "final" || Date.now() - cached.computedAt.getTime() < LIVE_TTL_MS)) {
      return {
        state: cached.state as PredictionState,
        platform: "LEETCODE",
        handle,
        rank: cached.rank,
        predictedDelta: cached.predictedDelta,
        currentRating: cached.currentRating,
        projectedRating: project(cached.currentRating, cached.predictedDelta),
        performance: cached.performance,
        computedAt: cached.computedAt,
      };
    }
  } catch {
    // fall through
  }

  const result = await fetchLeetCodePrediction(contest, handle);
  if (result.state !== "live" && result.state !== "final") return result;

  try {
    await prisma.ratingPrediction.upsert({
      where: { platform_externalId_handle: { platform: "LEETCODE", externalId: contest.externalId, handle: key } },
      create: {
        platform: "LEETCODE",
        externalId: contest.externalId,
        handle: key,
        rank: result.rank,
        predictedDelta: result.predictedDelta,
        currentRating: result.currentRating,
        performance: result.performance,
        state: result.state,
      },
      update: {
        rank: result.rank,
        predictedDelta: result.predictedDelta,
        currentRating: result.currentRating,
        performance: result.performance,
        state: result.state,
        computedAt: new Date(),
      },
    });
  } catch {
    // ignore cache write failures
  }
  return result;
}

// --------------------------------------------------------------------------
// Dispatcher
// --------------------------------------------------------------------------

/** Cache-first single-handle prediction for one contest. Never throws. */
export async function getPrediction(
  contest: ContestLike,
  handleRaw: string,
): Promise<ContestPrediction> {
  const handle = handleRaw.trim();
  if (!handle) return bare(contest.platform, handle, "unavailable");
  try {
    if (contest.platform === "CODEFORCES") return await getCfPrediction(contest, handle);
    if (contest.platform === "LEETCODE") return await getLcPrediction(contest, handle);
  } catch {
    return bare(contest.platform, handle, "unavailable");
  }
  return bare(contest.platform, handle, "unavailable");
}
