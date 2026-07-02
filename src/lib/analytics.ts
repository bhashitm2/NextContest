// Pure, client-safe derivations for the profile analytics section. All inputs
// come from the cached `PlatformHandle.stats` JSON (see profile-sync/types.ts);
// nothing here fetches. Days are UTC — same convention as the stored buckets.

import type { Platform } from "@/generated/prisma/client";

import { type ActivityDay, parseStats, type RatingPoint } from "./profile";

type HandleLike = { platform: Platform; handle: string; stats: unknown };

/** One platform's rating timeline, ready for the chart. */
export type TimelineSeries = {
  platform: Platform;
  handle: string;
  points: RatingPoint[];
};

/** Merged per-day activity across handles + which platforms contributed. */
export type MergedActivity = {
  days: ActivityDay[]; // ascending by day
  sources: Platform[];
};

export function mergeActivity(handles: HandleLike[]): MergedActivity {
  const counts = new Map<string, number>();
  const sources: Platform[] = [];
  for (const h of handles) {
    const activity = parseStats(h.stats).activity;
    if (!activity || activity.length === 0) continue;
    sources.push(h.platform);
    for (const { day, count } of activity) {
      counts.set(day, (counts.get(day) ?? 0) + count);
    }
  }
  const days = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
  return { days, sources };
}

export type Streaks = { current: number; longest: number; activeDays: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Current/longest consecutive-day streaks. "Today empty so far" doesn't break
 * the current streak (the day isn't over yet). */
export function computeStreaks(days: ActivityDay[], now = new Date()): Streaks {
  const active = new Set(days.filter((d) => d.count > 0).map((d) => d.day));

  let longest = 0;
  let run = 0;
  let prevMs: number | null = null;
  for (const d of days) {
    if (d.count <= 0) continue;
    const ms = Date.parse(`${d.day}T00:00:00Z`);
    run = prevMs != null && ms - prevMs === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevMs = ms;
  }

  const todayMs = Date.parse(`${utcDayKey(now.getTime())}T00:00:00Z`);
  let current = 0;
  let cursor = active.has(utcDayKey(todayMs)) ? todayMs : todayMs - DAY_MS;
  while (active.has(utcDayKey(cursor))) {
    current += 1;
    cursor -= DAY_MS;
  }

  return { current, longest, activeDays: active.size };
}

export type ContestSummary = {
  contestsThisMonth: number;
  bestRank90d: number | null;
  netDelta90d: number | null; // summed across platforms; null if no rated contest
};

export function summarizeContests(handles: HandleLike[], now = new Date()): ContestSummary {
  const monthPrefix = now.toISOString().slice(0, 7);
  const cutoff90 = now.getTime() - 90 * DAY_MS;

  let contestsThisMonth = 0;
  let bestRank90d: number | null = null;
  let netDelta90d: number | null = null;

  for (const h of handles) {
    for (const p of parseStats(h.stats).ratingHistory ?? []) {
      if (p.at.startsWith(monthPrefix)) contestsThisMonth += 1;
      if (Date.parse(p.at) >= cutoff90) {
        if (p.rank != null && (bestRank90d == null || p.rank < bestRank90d)) bestRank90d = p.rank;
        if (p.delta != null) netDelta90d = (netDelta90d ?? 0) + p.delta;
      }
    }
  }

  return { contestsThisMonth, bestRank90d, netDelta90d };
}

/** Per-platform rating series for the timeline chart (needs ≥2 points to draw). */
export function buildTimelineSeries(handles: HandleLike[]): TimelineSeries[] {
  return handles
    .map((h) => ({
      platform: h.platform,
      handle: h.handle,
      points: parseStats(h.stats).ratingHistory ?? [],
    }))
    .filter((s) => s.points.length >= 2);
}
