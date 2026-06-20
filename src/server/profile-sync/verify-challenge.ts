import { fetchJson, type ProfilePlatform } from "./types";

/** One pinned problem the user submits a deliberate compile error to. */
export type Challenge = {
  /** Match key, identical to what the submission fetchers compare against:
   *  CF `${contestId}-${index}` (e.g. "4-A"); AtCoder `problem_id` (e.g. "abc086_a"). */
  key: string;
  name: string;
  submitUrl: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// --- Codeforces: the official, full problemset (picked at random per challenge) ---
type CfProblem = { contestId?: number; index?: string; name: string };
type CfProblemset = { status: string; result?: { problems?: CfProblem[] } };
let cfPool: Challenge[] | null = null;
let cfPoolAt = 0;
async function codeforcesPool(): Promise<Challenge[]> {
  if (cfPool && Date.now() - cfPoolAt < DAY_MS) return cfPool;
  const json = await fetchJson<CfProblemset>("https://codeforces.com/api/problemset.problems");
  const pool = (json.result?.problems ?? [])
    .filter((p): p is CfProblem & { contestId: number; index: string } => !!p.contestId && !!p.index)
    .map((p) => ({
      key: `${p.contestId}-${p.index}`,
      name: `${p.name} (${p.contestId}${p.index})`,
      submitUrl: `https://codeforces.com/problemset/submit/${p.contestId}/${p.index}`,
    }));
  if (pool.length > 0) {
    cfPool = pool;
    cfPoolAt = Date.now();
  }
  return cfPool ?? pool;
}

// --- AtCoder: full task list via kenkoooo (AtCoder has no official list API) ---
type AcProblem = { id: string; contest_id: string; name?: string; title?: string };
let acPool: Challenge[] | null = null;
let acPoolAt = 0;
async function atcoderPool(): Promise<Challenge[]> {
  if (acPool && Date.now() - acPoolAt < DAY_MS) return acPool;
  const arr = await fetchJson<AcProblem[]>(
    "https://kenkoooo.com/atcoder/resources/problems.json",
  );
  const pool = arr
    // Standard ABC/ARC/AGC families — always open for submission, English titles.
    .filter((p) => p.id && p.contest_id && /^(abc|arc|agc)\d/.test(p.contest_id))
    .map((p) => ({
      key: p.id,
      name: p.name ?? p.title ?? p.id,
      submitUrl: `https://atcoder.jp/contests/${p.contest_id}/submit?taskScreenName=${p.id}`,
    }));
  if (pool.length > 0) {
    acPool = pool;
    acPoolAt = Date.now();
  }
  return acPool ?? pool;
}

// Tiny curated fallback used only if the live problem-set fetch fails.
const CF_FALLBACK: Challenge[] = [
  { key: "4-A", name: "Watermelon (4A)", submitUrl: "https://codeforces.com/problemset/submit/4/A" },
  { key: "1-A", name: "Theatre Square (1A)", submitUrl: "https://codeforces.com/problemset/submit/1/A" },
];
const AC_FALLBACK: Challenge[] = [
  {
    key: "abc086_a",
    name: "Product (ABC086 A)",
    submitUrl: "https://atcoder.jp/contests/abc086/submit?taskScreenName=abc086_a",
  },
];

/** Platforms with a reliable public submission API for compile-error verification. */
export function supportsSubmissionVerify(platform: ProfilePlatform): boolean {
  return platform === "CODEFORCES" || platform === "ATCODER";
}

/** A random problem from the platform's live problem set (fallback list on fetch failure). */
export async function pickChallenge(platform: ProfilePlatform): Promise<Challenge> {
  let pool: Challenge[] = [];
  try {
    if (platform === "CODEFORCES") pool = await codeforcesPool();
    else if (platform === "ATCODER") pool = await atcoderPool();
  } catch {
    pool = [];
  }
  if (pool.length === 0) {
    pool = platform === "CODEFORCES" ? CF_FALLBACK : platform === "ATCODER" ? AC_FALLBACK : [];
  }
  if (pool.length === 0) throw new Error(`No compile-error challenge available for ${platform}`);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** A guaranteed clean compilation error: the C/C++ `#error` directive. */
export const CE_SNIPPET = "#error NextContest verify";

/** Language hint shown next to the snippet. */
export const CE_LANGUAGE_HINT = "Submit as C++ (any GNU C++ version).";
