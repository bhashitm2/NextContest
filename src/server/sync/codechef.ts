import { difficultyFromTitle, fetchJson, type NormalizedContest } from "./types";

type CcContest = {
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string;
  contest_end_date_iso: string;
};

type CcResponse = { future_contests?: CcContest[] };

const CC_API =
  "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all";

/** Upcoming contests from CodeChef's public listing API. */
export async function fetchCodeChef(): Promise<NormalizedContest[]> {
  const json = await fetchJson<CcResponse>(CC_API, {
    headers: { Referer: "https://www.codechef.com/contests" },
  });

  const contests = json.future_contests ?? [];

  return contests.map((c) => {
    const startTime = new Date(c.contest_start_date_iso);
    const endTime = new Date(c.contest_end_date_iso);
    return {
      platform: "CODECHEF",
      externalId: c.contest_code,
      title: c.contest_name,
      url: `https://www.codechef.com/${c.contest_code}`,
      startTime,
      endTime,
      durationSeconds: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
      difficulty: difficultyFromTitle(c.contest_name),
    } satisfies NormalizedContest;
  });
}
