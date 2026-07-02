import type { Platform } from "@/generated/prisma/client";

export { fetchJson, USER_AGENT } from "@/server/sync/types";

/** Easy/medium/hard split of solved problems (best-effort per platform). */
export type DifficultyBreakdown = { easy: number; medium: number; hard: number };

/** A recently-solved problem, for the activity list. */
export type RecentSolved = { title: string; url: string | null; at: string };

/** Number of distinct problems solved in a given month ("YYYY-MM"). */
export type SolvedMonth = { month: string; count: number };

/** Problems solved carrying a given topic tag (e.g. "Binary Search"). */
export type TagCount = { tag: string; count: number };

/** Submissions made on a given UTC day ("YYYY-MM-DD"), for the activity heatmap. */
export type ActivityDay = { day: string; count: number };

/** One point of a handle's rating timeline (contest-by-contest). */
export type RatingPoint = {
  at: string; // ISO date of the contest
  rating: number; // rating after the contest
  delta: number | null;
  rank: number | null;
};

/**
 * A user's stats on one platform, normalized across sources. The top-level
 * fields map to PlatformHandle columns; `extra` is stored in the `stats` JSON
 * column. Every field is optional/nullable so a partial fetch still persists.
 */
export type ProfileStats = {
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  problemsSolved: number | null;
  extra: {
    difficulty?: DifficultyBreakdown;
    contests?: number;
    recentSolved?: RecentSolved[];
    solvedByMonth?: SolvedMonth[];
    tags?: TagCount[];
    activity?: ActivityDay[];
    ratingHistory?: RatingPoint[];
  };
};

/** Keep the persisted jsonb (and the RSC payload built from it) bounded. */
export const ACTIVITY_WINDOW_DAYS = 366;
export const RATING_HISTORY_MAX_POINTS = 500;

/** The shape persisted to `PlatformHandle.stats`. */
export type ProfileStatsExtra = ProfileStats["extra"];

/** "YYYY-MM" bucket key for a Date (UTC). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Roll a list of solve-dates into ascending {month,count} buckets. */
export function bucketByMonth(dates: Date[]): SolvedMonth[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const k = monthKey(d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

/** "YYYY-MM-DD" bucket key for a Date (UTC). */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Roll submission dates into ascending {day,count} buckets, keeping only the
 * trailing activity window. */
export function bucketByDay(dates: Date[], windowDays = ACTIVITY_WINDOW_DAYS): ActivityDay[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (d.getTime() < cutoff) continue;
    const k = dayKey(d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
}

/** Platforms the profile feature can fetch stats for — the single source of truth
 * (drives the `ProfilePlatform` type, the `handle` router's input enum, and the
 * profile-sync registries). Append a platform here when its fetchers land. */
export const PROFILE_PLATFORM_VALUES = [
  "CODEFORCES",
  "LEETCODE",
  "ATCODER",
  "CODECHEF",
  "GEEKSFORGEEKS",
  "CODE360",
  "HACKERRANK",
] as const satisfies readonly Platform[];

/** A platform the profile feature can fetch stats for. */
export type ProfilePlatform = (typeof PROFILE_PLATFORM_VALUES)[number];

/** Where the verification token must be pasted, per platform (shown in the UI). */
export const VERIFICATION_FIELD: Record<ProfilePlatform, string> = {
  CODEFORCES: "First name (Settings → Social)",
  LEETCODE: "README / Summary (Edit Profile)",
  ATCODER: "Affiliation (Settings → General Settings)",
  CODECHEF: "Name (Edit Profile)",
  GEEKSFORGEEKS: "Name field (your profile → Edit Profile)",
  CODE360: "Name field (your profile → Edit Profile)",
  HACKERRANK: "First name field (your profile → click the ✎ pencil to edit)",
};
