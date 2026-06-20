import type { Platform } from "@/generated/prisma/client";

import { PLATFORM_META } from "@/lib/platforms";
import { aggregateTags, parseStats, totalSolved } from "@/lib/profile";

/** Who leads a single comparison. */
export type Winner = "a" | "b" | "tie";

/** One verified handle, reduced to the fields the comparison needs. */
export type CompareHandle = {
  platform: Platform;
  rating: number | null;
  maxRating: number | null;
  problemsSolved: number | null;
  stats: unknown;
};

/** A competitor in a head-to-head comparison. */
export type CompareUser = {
  username: string | null;
  name: string | null;
  image: string | null;
  handles: CompareHandle[];
};

/** A single head-to-head metric (rating on a platform, total solved, …). */
export type CompareCategory = {
  key: string;
  label: string;
  /** Platform this category belongs to (for brand coloring), if any. */
  platform: Platform | null;
  aValue: number;
  bValue: number;
  /** "rating" → raw number; "number" → thousands-separated count. */
  format: "rating" | "number";
  winner: Winner;
};

/** Per-tag lead in the topic breakdown. */
export type TopicLead = {
  tag: string;
  aCount: number;
  bCount: number;
  winner: Winner;
};

export type CompareResult = {
  /** Display info echoed back so the view layer has everything in one object. */
  a: { username: string | null; name: string | null; image: string | null };
  b: { username: string | null; name: string | null; image: string | null };
  /** Platforms both competitors have verified (used for head-to-head ratings). */
  commonPlatforms: Platform[];
  categories: CompareCategory[];
  topics: { leads: TopicLead[]; aWon: number; bWon: number; winner: Winner };
  /** Transparent point tally: one point per category won + one for topic majority. */
  overall: { winner: Winner; aScore: number; bScore: number };
};

/** Higher value wins. Used everywhere so tie handling stays consistent. */
function pickWinner(a: number, b: number): Winner {
  if (a > b) return "a";
  if (b > a) return "b";
  return "tie";
}

/** Best available rating for a handle (current, falling back to peak). */
function handleRating(h: CompareHandle): number {
  return h.rating ?? h.maxRating ?? 0;
}

/** Sum of contests played across a user's handles (from stats.extra.contests). */
function totalContests(handles: CompareHandle[]): number {
  return handles.reduce((sum, h) => sum + (parseStats(h.stats).contests ?? 0), 0);
}

/**
 * Deterministic head-to-head comparison of two competitors. All numbers are
 * computed here (no LLM math) — the AI layer only narrates this result.
 */
export function compareProfiles(a: CompareUser, b: CompareUser): CompareResult {
  const byPlatform = (u: CompareUser) =>
    new Map(u.handles.map((h) => [h.platform, h] as const));
  const aMap = byPlatform(a);
  const bMap = byPlatform(b);

  const commonPlatforms = [...aMap.keys()].filter((p) => bMap.has(p));

  const categories: CompareCategory[] = [];

  // Per-common-platform rating head-to-head.
  for (const platform of commonPlatforms) {
    const aValue = handleRating(aMap.get(platform)!);
    const bValue = handleRating(bMap.get(platform)!);
    categories.push({
      key: `rating:${platform}`,
      label: `${PLATFORM_META[platform].label} rating`,
      platform,
      aValue,
      bValue,
      format: "rating",
      winner: pickWinner(aValue, bValue),
    });
  }

  // Total problems solved (across all platforms).
  {
    const aValue = totalSolved(a.handles);
    const bValue = totalSolved(b.handles);
    categories.push({
      key: "totalSolved",
      label: "Total problems solved",
      platform: null,
      aValue,
      bValue,
      format: "number",
      winner: pickWinner(aValue, bValue),
    });
  }

  // Total contests played (only if anyone has any).
  {
    const aValue = totalContests(a.handles);
    const bValue = totalContests(b.handles);
    if (aValue > 0 || bValue > 0) {
      categories.push({
        key: "totalContests",
        label: "Contests played",
        platform: null,
        aValue,
        bValue,
        format: "number",
        winner: pickWinner(aValue, bValue),
      });
    }
  }

  // Topic-by-topic leads (union of tags, sorted by combined volume).
  const aTags = new Map(aggregateTags(a.handles).map((t) => [t.tag, t.count]));
  const bTags = new Map(aggregateTags(b.handles).map((t) => [t.tag, t.count]));
  const allTags = new Set([...aTags.keys(), ...bTags.keys()]);

  let aWon = 0;
  let bWon = 0;
  const leads: TopicLead[] = [...allTags]
    .map((tag) => {
      const aCount = aTags.get(tag) ?? 0;
      const bCount = bTags.get(tag) ?? 0;
      const winner = pickWinner(aCount, bCount);
      if (winner === "a") aWon += 1;
      else if (winner === "b") bWon += 1;
      return { tag, aCount, bCount, winner };
    })
    .sort((x, y) => y.aCount + y.bCount - (x.aCount + x.bCount));

  const topics = { leads, aWon, bWon, winner: pickWinner(aWon, bWon) };

  // Transparent overall score: one point per category won, plus one point for
  // winning the topic majority. Ties award no point.
  let aScore = 0;
  let bScore = 0;
  for (const c of categories) {
    if (c.winner === "a") aScore += 1;
    else if (c.winner === "b") bScore += 1;
  }
  if (topics.winner === "a") aScore += 1;
  else if (topics.winner === "b") bScore += 1;

  return {
    a: { username: a.username, name: a.name, image: a.image },
    b: { username: b.username, name: b.name, image: b.image },
    commonPlatforms,
    categories,
    topics,
    overall: { winner: pickWinner(aScore, bScore), aScore, bScore },
  };
}
