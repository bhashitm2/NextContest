import { fetchJson } from "@/server/profile-sync/types";

// Codeforces submission checks for duels — same API shapes as the profile-sync
// fetchers (user.status, verdict "OK", problem key `${contestId}-${index}`).

type CfSubmission = {
  creationTimeSeconds: number;
  problem: { contestId?: number; index?: string; name: string };
  verdict?: string;
};
type CfStatusResponse = { status: string; result?: CfSubmission[]; comment?: string };

const API = "https://codeforces.com/api";

const keyOf = (p: CfSubmission["problem"]) => `${p.contestId ?? "?"}-${p.index ?? p.name}`;

/** Every problem key the handle has EVER solved (full user.status — one call). */
export async function fetchSolvedKeys(handle: string): Promise<Set<string>> {
  const json = await fetchJson<CfStatusResponse>(
    `${API}/user.status?handle=${encodeURIComponent(handle)}`,
  );
  if (json.status !== "OK") throw new Error(`Codeforces: ${json.comment ?? "non-OK"}`);
  const solved = new Set<string>();
  for (const s of json.result ?? []) {
    if (s.verdict === "OK") solved.add(keyOf(s.problem));
  }
  return solved;
}

/** Earliest accepted submission per problem key within [fromSec, toSec].
 * `count` bounds how far back user.status looks (newest-first). */
export async function fetchWindowAcs(
  handle: string,
  fromSec: number,
  toSec: number,
  count: number,
): Promise<Map<string, number>> {
  const json = await fetchJson<CfStatusResponse>(
    `${API}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`,
  );
  if (json.status !== "OK") throw new Error(`Codeforces: ${json.comment ?? "non-OK"}`);
  const acs = new Map<string, number>();
  for (const s of json.result ?? []) {
    if (s.verdict !== "OK") continue;
    const t = s.creationTimeSeconds;
    if (t < fromSec || t > toSec) continue;
    const key = keyOf(s.problem);
    const prev = acs.get(key);
    if (prev === undefined || t < prev) acs.set(key, t);
  }
  return acs;
}
