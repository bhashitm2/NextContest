import { difficultyFromTitle, fetchJson, type NormalizedContest, pastCutoffMs } from "./types";

type CcContest = {
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string;
  contest_end_date_iso: string;
};

type CcResponse = { future_contests?: CcContest[]; past_contests?: CcContest[] };

// `desc` so `past_contests` returns the most-recent finished contests. NOTE:
// CodeChef caps `past_contests` at ~20 and `offset` does NOT page it, so the
// back-fill only reaches a few weeks back — older history accrues naturally as
// each contest is captured while upcoming.
const CC_API =
  "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=desc&offset=0&mode=all";

function toContest(c: CcContest): NormalizedContest {
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
  };
}

/** Upcoming contests plus the most-recent finished ones (within the window). */
export async function fetchCodeChef(): Promise<NormalizedContest[]> {
  const json = await fetchJson<CcResponse>(CC_API, {
    headers: { Referer: "https://www.codechef.com/contests" },
  });

  const cutoff = pastCutoffMs();
  const past = (json.past_contests ?? []).filter(
    (c) => new Date(c.contest_start_date_iso).getTime() >= cutoff,
  );
  return [...(json.future_contests ?? []), ...past].map(toContest);
}
