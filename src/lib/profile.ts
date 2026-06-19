import type { Platform } from "@/generated/prisma/client";

// Client-safe mirror of the server ProfileStats.extra shape (server module
// pulls in fetch helpers, so we keep a plain type here for components).
export type DifficultyBreakdown = { easy: number; medium: number; hard: number };
export type RecentSolved = { title: string; url: string | null; at: string };
export type SolvedMonth = { month: string; count: number };
export type TagCount = { tag: string; count: number };
export type ProfileStatsExtra = {
  difficulty?: DifficultyBreakdown;
  contests?: number;
  recentSolved?: RecentSolved[];
  solvedByMonth?: SolvedMonth[];
  tags?: TagCount[];
};

/** A connected handle as rendered by the UI (subset of the Prisma row). */
export type HandleView = {
  platform: Platform;
  handle: string;
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  problemsSolved: number | null;
  stats: unknown;
  lastSynced: Date | string | null;
};

/** Safely coerce the JSON `stats` column to the typed extra shape. */
export function parseStats(json: unknown): ProfileStatsExtra {
  return (json && typeof json === "object" ? (json as ProfileStatsExtra) : {}) ?? {};
}

/** Total distinct problems solved across the given handles. */
export function totalSolved(handles: { problemsSolved: number | null }[]): number {
  return handles.reduce((sum, h) => sum + (h.problemsSolved ?? 0), 0);
}

// Codeforces tags are lowercase ("binary search"), LeetCode are Title Case
// ("Binary Search") — map common overlaps to one canonical label so the
// combined topic chart doesn't double-count. Unlisted tags are Title-Cased.
const TAG_ALIASES: Record<string, string> = {
  dp: "Dynamic Programming",
  "dfs and similar": "Depth-First Search",
  dfs: "Depth-First Search",
  bfs: "Breadth-First Search",
  "two pointer": "Two Pointers",
  graph: "Graphs",
  string: "Strings",
  tree: "Trees",
  "hash table": "Hashing",
  hashing: "Hashing",
  sortings: "Sorting",
  mathematics: "Math",
  "bit manipulation": "Bitmasks",
  "number theory": "Number Theory",
  "union find": "DSU",
  dsu: "DSU",
  "binary indexed tree": "Fenwick Tree",
  "shortest paths": "Shortest Paths",
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Canonical display label for a raw platform tag. */
export function normalizeTag(raw: string): string {
  const key = raw.trim().toLowerCase();
  return TAG_ALIASES[key] ?? titleCase(key);
}

/** Merge tag counts across handles into one descending list of {tag,count}. */
export function aggregateTags(handles: { stats: unknown }[]): TagCount[] {
  const totals = new Map<string, number>();
  for (const h of handles) {
    for (const { tag, count } of parseStats(h.stats).tags ?? []) {
      const label = normalizeTag(tag);
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** Client-safe mirror of the server's VERIFICATION_FIELD (where to paste the
 * token on each platform). Kept here so client components avoid server imports. */
export const VERIFICATION_FIELD: Record<string, string> = {
  CODEFORCES: "First name (Settings → Social)",
  LEETCODE: "README / Summary (Edit Profile)",
  ATCODER: "Affiliation (Settings → General Settings)",
  CODECHEF: "Name (Edit Profile)",
};

/** Public profile/account URL for a handle, per platform. */
export function platformProfileUrl(platform: string, handle: string): string {
  const h = encodeURIComponent(handle);
  switch (platform) {
    case "CODEFORCES":
      return `https://codeforces.com/profile/${h}`;
    case "LEETCODE":
      return `https://leetcode.com/u/${h}/`;
    case "ATCODER":
      return `https://atcoder.jp/users/${h}`;
    case "CODECHEF":
      return `https://www.codechef.com/users/${h}`;
    default:
      return "#";
  }
}

/** "Jun '26" label for a "YYYY-MM" bucket key. */
export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short" });
  return `${name} '${String(y).slice(2)}`;
}
