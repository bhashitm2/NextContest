import { TRPCError } from "@trpc/server";

import { fetchSolvedKeys } from "./cf-judge";
import { codeforcesRatedPool } from "./cf-pool";

/** One duel problem as persisted in Duel.problems (Json). Solve timestamps are
 * ISO strings filled in by the judge; A = challenger, B = opponent. */
export type DuelProblem = {
  key: string;
  name: string;
  rating: number;
  url: string;
  solvedByA: string | null;
  solvedByB: string | null;
};

/** N random problems in [ratingMin, ratingMax] that NEITHER handle has ever
 * solved. Called once, at accept time; the result is persisted on the duel. */
export async function selectDuelProblems(
  handleA: string,
  handleB: string,
  ratingMin: number,
  ratingMax: number,
  n: number,
): Promise<DuelProblem[]> {
  const [pool, solvedA, solvedB] = await Promise.all([
    codeforcesRatedPool(),
    fetchSolvedKeys(handleA),
    fetchSolvedKeys(handleB),
  ]);

  const candidates = pool.filter(
    (p) =>
      p.rating >= ratingMin && p.rating <= ratingMax && !solvedA.has(p.key) && !solvedB.has(p.key),
  );

  if (candidates.length < n) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Not enough unsolved problems in this rating band — try a wider range.",
    });
  }

  // Fisher-Yates on a copy, take the first n.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, n).map((p) => ({
    key: p.key,
    name: p.name,
    rating: p.rating,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    solvedByA: null,
    solvedByB: null,
  }));
}
