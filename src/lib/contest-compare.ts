import type { Platform } from "@/generated/prisma/client";

/** One user's finalized performance on a single contest. Every field is
 * nullable — platforms differ in what they expose (CF/CodeChef give no
 * problems-solved; only AtCoder gives a performance value). */
export type ContestPerformance = {
  participated: boolean;
  rank: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  problemsSolved: number | null;
  performance: number | null; // AtCoder only
};

export type ContestWinner = "a" | "b" | "tie";

export type ContestCategoryKey = "rank" | "ratingDelta" | "problemsSolved";

export type ContestCategory = {
  key: ContestCategoryKey;
  label: string;
  aValue: number | null;
  bValue: number | null;
  format: "rank" | "delta" | "number";
  /** True for Rank (a smaller number is better). Drives both the winner and
   * the crown placement in the UI. */
  lowerIsBetter: boolean;
  winner: ContestWinner;
};

export type ContestSide = {
  username: string | null;
  name: string | null;
  image: string | null;
  perf: ContestPerformance;
};

export type ContestCompareResult = {
  a: ContestSide;
  b: ContestSide;
  platform: Platform;
  contestTitle: string;
  contestUrl: string;
  categories: ContestCategory[];
  overall: { winner: ContestWinner; aScore: number; bScore: number };
};

type CategoryDef = {
  key: ContestCategoryKey;
  label: string;
  format: "rank" | "delta" | "number";
  lowerIsBetter: boolean;
  get: (p: ContestPerformance) => number | null;
};

// `performance` is deliberately NOT a scored category — only AtCoder reports it,
// so scoring on it would make matches asymmetric across platforms. The UI shows
// it as an informational stat instead.
const CATEGORY_DEFS: CategoryDef[] = [
  { key: "rank", label: "Rank", format: "rank", lowerIsBetter: true, get: (p) => p.rank },
  {
    key: "ratingDelta",
    label: "Rating change",
    format: "delta",
    lowerIsBetter: false,
    get: (p) => p.ratingDelta,
  },
  {
    key: "problemsSolved",
    label: "Problems solved",
    format: "number",
    lowerIsBetter: false,
    get: (p) => p.problemsSolved,
  },
];

/** Decide a head-to-head category winner. Only called when both values exist. */
function pick(a: number, b: number, lowerIsBetter: boolean): ContestWinner {
  if (a === b) return "tie";
  const aWins = lowerIsBetter ? a < b : a > b;
  return aWins ? "a" : "b";
}

/**
 * Compare two users' performance on one contest. Pure + deterministic.
 * A category is only emitted (and scored) when BOTH sides have a value, so
 * platform gaps never award phantom points. Overall = one point per decided
 * category; equal points = tie.
 */
export function compareContestPerf(
  a: ContestSide,
  b: ContestSide,
  meta: { platform: Platform; contestTitle: string; contestUrl: string },
): ContestCompareResult {
  const categories: ContestCategory[] = [];
  let aScore = 0;
  let bScore = 0;

  for (const def of CATEGORY_DEFS) {
    const aValue = def.get(a.perf);
    const bValue = def.get(b.perf);
    if (aValue === null || bValue === null) continue; // skip — not comparable

    const winner = pick(aValue, bValue, def.lowerIsBetter);
    if (winner === "a") aScore += 1;
    else if (winner === "b") bScore += 1;

    categories.push({
      key: def.key,
      label: def.label,
      aValue,
      bValue,
      format: def.format,
      lowerIsBetter: def.lowerIsBetter,
      winner,
    });
  }

  const overallWinner: ContestWinner = aScore === bScore ? "tie" : aScore > bScore ? "a" : "b";

  return {
    a,
    b,
    platform: meta.platform,
    contestTitle: meta.contestTitle,
    contestUrl: meta.contestUrl,
    categories,
    overall: { winner: overallWinner, aScore, bScore },
  };
}
