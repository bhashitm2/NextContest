import { difficultyFromTitle, fetchJson, type NormalizedContest, pastCutoffMs } from "./types";

type CfContest = {
  id: number;
  name: string;
  phase: string; // BEFORE | CODING | FINISHED | ...
  startTimeSeconds?: number;
  durationSeconds: number;
};

type CfResponse = { status: string; result: CfContest[]; comment?: string };

const CF_API = "https://codeforces.com/api/contest.list?gym=false";

/** Upcoming + ongoing contests, plus finished ones within the back-fill window,
 * from the official Codeforces API (one call returns every phase). */
export async function fetchCodeforces(): Promise<NormalizedContest[]> {
  const json = await fetchJson<CfResponse>(CF_API);
  if (json.status !== "OK") {
    throw new Error(`Codeforces API: ${json.comment ?? "non-OK status"}`);
  }

  const cutoff = pastCutoffMs();
  return json.result
    .filter((c) => c.startTimeSeconds && c.startTimeSeconds * 1000 >= cutoff)
    .map((c) => {
      const startTime = new Date(c.startTimeSeconds! * 1000);
      return {
        platform: "CODEFORCES",
        externalId: String(c.id),
        title: c.name,
        url: `https://codeforces.com/contest/${c.id}`,
        startTime,
        endTime: new Date(startTime.getTime() + c.durationSeconds * 1000),
        durationSeconds: c.durationSeconds,
        difficulty: difficultyFromTitle(c.name),
      } satisfies NormalizedContest;
    });
}
