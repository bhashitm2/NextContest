import { difficultyFromTitle, fetchJson, type NormalizedContest } from "./types";

type CfContest = {
  id: number;
  name: string;
  phase: string; // BEFORE | CODING | FINISHED | ...
  startTimeSeconds?: number;
  durationSeconds: number;
};

type CfResponse = { status: string; result: CfContest[]; comment?: string };

const CF_API = "https://codeforces.com/api/contest.list?gym=false";

/** Upcoming + ongoing contests from the official Codeforces API. */
export async function fetchCodeforces(): Promise<NormalizedContest[]> {
  const json = await fetchJson<CfResponse>(CF_API);
  if (json.status !== "OK") {
    throw new Error(`Codeforces API: ${json.comment ?? "non-OK status"}`);
  }

  return json.result
    .filter((c) => (c.phase === "BEFORE" || c.phase === "CODING") && c.startTimeSeconds)
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
