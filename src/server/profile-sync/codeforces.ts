import { fetchJson, type ProfileStats, type RecentSolved } from "./types";

type CfUser = {
  handle: string;
  firstName?: string;
  lastName?: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
};
type CfInfoResponse = { status: string; result?: CfUser[]; comment?: string };

type CfSubmission = {
  id: number;
  creationTimeSeconds: number;
  problem: { contestId?: number; index?: string; name: string; rating?: number; tags?: string[] };
  verdict?: string;
};
type CfStatusResponse = { status: string; result?: CfSubmission[]; comment?: string };

type CfRatingResponse = { status: string; result?: { contestId: number }[] };

const API = "https://codeforces.com/api";

/** Number of rated contests the user has participated in. */
async function contestCount(handle: string): Promise<number | undefined> {
  try {
    const json = await fetchJson<CfRatingResponse>(
      `${API}/user.rating?handle=${encodeURIComponent(handle)}`,
    );
    return json.status === "OK" ? json.result?.length : undefined;
  } catch {
    return undefined;
  }
}

async function userInfo(handle: string): Promise<CfUser | null> {
  const json = await fetchJson<CfInfoResponse>(
    `${API}/user.info?handles=${encodeURIComponent(handle)}`,
  );
  if (json.status !== "OK") throw new Error(`Codeforces: ${json.comment ?? "non-OK"}`);
  return json.result?.[0] ?? null;
}

const problemKey = (p: CfSubmission["problem"]) => `${p.contestId ?? "?"}-${p.index ?? p.name}`;

/** Bucket CF problem ratings into easy/medium/hard. */
function difficultyBucket(rating: number | undefined): "easy" | "medium" | "hard" | null {
  if (!rating) return null;
  if (rating < 1400) return "easy";
  if (rating < 2000) return "medium";
  return "hard";
}

/** Confirm the handle exists; throw if not. Returns the canonical handle. */
export async function validateCodeforces(handle: string): Promise<string> {
  const user = await userInfo(handle);
  if (!user) throw new Error("Codeforces handle not found");
  return user.handle;
}

/** Text to scan for the verification token (CF First/Last name). */
export async function fetchCodeforcesVerificationField(handle: string): Promise<string> {
  const user = await userInfo(handle);
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ");
}

/** Full per-user stats from the official Codeforces API. */
export async function fetchCodeforcesStats(handle: string): Promise<ProfileStats> {
  const user = await userInfo(handle);
  if (!user) throw new Error("Codeforces handle not found");

  const status = await fetchJson<CfStatusResponse>(
    `${API}/user.status?handle=${encodeURIComponent(handle)}`,
  );
  const subs = status.result ?? [];

  // First accepted submission per distinct problem (subs come newest-first).
  const firstAc = new Map<string, CfSubmission>();
  for (const s of subs) {
    if (s.verdict !== "OK") continue;
    const key = problemKey(s.problem);
    const prev = firstAc.get(key);
    if (!prev || s.creationTimeSeconds < prev.creationTimeSeconds) firstAc.set(key, s);
  }

  const solved = [...firstAc.values()];
  const difficulty = { easy: 0, medium: 0, hard: 0 };
  const tagCounts = new Map<string, number>();
  for (const s of solved) {
    const b = difficultyBucket(s.problem.rating);
    if (b) difficulty[b] += 1;
    for (const tag of s.problem.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()].map(([tag, count]) => ({ tag, count }));

  const recentSolved: RecentSolved[] = solved
    .sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds)
    .slice(0, 10)
    .map((s) => ({
      title: s.problem.name,
      url:
        s.problem.contestId && s.problem.index
          ? `https://codeforces.com/contest/${s.problem.contestId}/problem/${s.problem.index}`
          : null,
      at: new Date(s.creationTimeSeconds * 1000).toISOString(),
    }));

  const contests = await contestCount(handle);

  return {
    rating: user.rating ?? null,
    maxRating: user.maxRating ?? null,
    rank: user.rank ?? null,
    problemsSolved: solved.length,
    extra: { difficulty, contests, recentSolved, tags },
  };
}
