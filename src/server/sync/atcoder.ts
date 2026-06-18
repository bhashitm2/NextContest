import * as cheerio from "cheerio";

import { difficultyFromTitle, type NormalizedContest, USER_AGENT } from "./types";

// AtCoder has no official API. The community kenkoooo dataset lags, so we scrape
// the official "Upcoming Contests" table — the source of truth (server-rendered
// HTML, no headless browser needed).
const AC_URL = "https://atcoder.jp/contests/";

export async function fetchAtCoder(): Promise<NormalizedContest[]> {
  const res = await fetch(AC_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`AtCoder HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const out: NormalizedContest[] = [];

  $("#contest-table-upcoming tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;

    // Start time, e.g. "2026-06-20 21:00:00+0900" → normalize offset to "+09:00".
    const timeText = $(tds[0]).find("time").text().trim();
    const iso = timeText.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const startTime = new Date(iso);
    if (Number.isNaN(startTime.getTime())) return;

    const link = $(tds[1]).find('a[href^="/contests/"]').first();
    const href = link.attr("href");
    const title = link.text().trim();
    if (!href || !title) return;

    // Duration "HH:MM" → seconds.
    const [hh, mm] = $(tds[2]).text().trim().split(":").map((n) => parseInt(n, 10));
    const durationSeconds = ((hh || 0) * 60 + (mm || 0)) * 60;
    if (!durationSeconds) return;

    const externalId = href.split("/").filter(Boolean).pop()!;
    out.push({
      platform: "ATCODER",
      externalId,
      title,
      url: `https://atcoder.jp${href}`,
      startTime,
      endTime: new Date(startTime.getTime() + durationSeconds * 1000),
      durationSeconds,
      difficulty: difficultyFromTitle(title),
    });
  });

  return out;
}
