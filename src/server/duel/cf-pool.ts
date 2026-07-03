import { fetchJson } from "@/server/profile-sync/types";

// Rating-retaining sibling of the verify-challenge problemset pool (that one
// deliberately drops `rating`; the duel picker filters by it, so it gets its
// own cache rather than widening the verification path's type).

export type CfPoolProblem = {
  key: string; // "contestId-index", same shape the submission fetchers compare
  contestId: number;
  index: string;
  name: string;
  rating: number;
};

type CfProblem = { contestId?: number; index?: string; name: string; rating?: number };
type CfProblemset = { status: string; result?: { problems?: CfProblem[] } };

const DAY_MS = 24 * 60 * 60 * 1000;

let pool: CfPoolProblem[] | null = null;
let poolAt = 0;

/** The full Codeforces problemset, rated problems only, cached 24h per instance. */
export async function codeforcesRatedPool(): Promise<CfPoolProblem[]> {
  if (pool && Date.now() - poolAt < DAY_MS) return pool;
  const json = await fetchJson<CfProblemset>("https://codeforces.com/api/problemset.problems");
  const next = (json.result?.problems ?? [])
    .filter(
      (p): p is CfProblem & { contestId: number; index: string; rating: number } =>
        !!p.contestId && !!p.index && typeof p.rating === "number",
    )
    .map((p) => ({
      key: `${p.contestId}-${p.index}`,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
    }));
  if (next.length > 0) {
    pool = next;
    poolAt = Date.now();
  }
  return pool ?? next;
}
