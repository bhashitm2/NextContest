import * as cheerio from "cheerio";

import { fetchJson, type ProfileStats, type RecentSolved, USER_AGENT } from "./types";

const PROFILE = (h: string) => `https://www.codechef.com/users/${encodeURIComponent(h)}`;
const RECENT = (h: string) =>
  `https://www.codechef.com/recent/user?user_handle=${encodeURIComponent(h)}&page=0`;

/** Parse CodeChef's "08:33 PM 17/06/26" (IST) into an ISO instant. */
function parseCcTime(s: string): string | null {
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{2})\/(\d{2})\/(\d{2})/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  const [, , min, , dd, mm, yy] = m;
  // Wall-clock is IST (UTC+5:30); convert to the real UTC instant.
  const istMs = Date.UTC(2000 + Number(yy), Number(mm) - 1, Number(dd), h, Number(min));
  return new Date(istMs - 5.5 * 60 * 60 * 1000).toISOString();
}

// Problem code → full name (e.g. OROPS → "OR Operations"). Names are stable, so
// cache for the process lifetime to avoid re-hitting CodeChef on every refresh.
const ccProblemNames = new Map<string, string>();
async function resolveProblemName(contest: string, code: string): Promise<string> {
  if (ccProblemNames.has(code)) return ccProblemNames.get(code)!;
  try {
    const j = await fetchJson<{ problem_name?: string }>(
      `https://www.codechef.com/api/contests/${encodeURIComponent(contest)}/problems/${encodeURIComponent(code)}`,
      { headers: { "X-Requested-With": "XMLHttpRequest" } },
    );
    const name = j.problem_name?.trim() || code;
    ccProblemNames.set(code, name);
    return name;
  } catch {
    return code;
  }
}

/** Recently accepted problems from CodeChef's recent-activity endpoint. */
async function fetchRecentSolved(handle: string): Promise<RecentSolved[]> {
  try {
    const json = await fetchJson<{ content?: string }>(RECENT(handle), {
      headers: { "X-Requested-With": "XMLHttpRequest", Referer: PROFILE(handle) },
    });
    if (!json.content) return [];
    const $ = cheerio.load(json.content);
    const rows: { code: string; contest: string; url: string | null; at: string }[] = [];
    const seen = new Set<string>();
    $("tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      const verdict = $(tds[2]).find("span[title]").attr("title") ?? "";
      if (!/accepted/i.test(verdict)) return;
      const link = $(tds[1]).find("a").first();
      const code = link.text().trim();
      if (!code || seen.has(code)) return;
      seen.add(code);
      const href = link.attr("href") ?? "";
      const parts = href.split("/").filter(Boolean); // ["START243C","problems","OROPS"]
      const contest = parts[0] === "problems" ? "PRACTICE" : (parts[0] ?? "PRACTICE");
      const at = parseCcTime($(tds[0]).find(".tooltiptext").text().trim() || "");
      rows.push({
        code,
        contest,
        url: href ? `https://www.codechef.com${href}` : null,
        at: at ?? new Date().toISOString(),
      });
    });

    const top = rows.slice(0, 10);
    return Promise.all(
      top.map(async (r) => ({
        title: await resolveProblemName(r.contest, r.code),
        url: r.url,
        at: r.at,
      })),
    );
  } catch {
    return [];
  }
}

async function loadProfile(handle: string): Promise<cheerio.CheerioAPI> {
  const res = await fetch(PROFILE(handle), {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw new Error("CodeChef handle not found");
  if (!res.ok) throw new Error(`CodeChef HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  // CodeChef serves a "user not found" page with 200 — detect it.
  if ($(".rating-number").length === 0 && /user not found/i.test($("body").text())) {
    throw new Error("CodeChef handle not found");
  }
  return $;
}

export async function validateCodeChef(handle: string): Promise<string> {
  await loadProfile(handle);
  return handle;
}

/** Profile text to scan for the verification token (the display Name). */
export async function fetchCodeChefVerificationField(handle: string): Promise<string> {
  const $ = await loadProfile(handle);
  const details = $(".user-details-container").text().trim();
  return details || $("header").text().trim();
}

/** Best-effort per-user stats scraped from the CodeChef profile page. */
export async function fetchCodeChefStats(handle: string): Promise<ProfileStats> {
  const $ = await loadProfile(handle);

  const rating = parseInt($(".rating-number").first().text().replace(/[^\d]/g, ""), 10);
  const headerText = $(".rating-header").first().text();
  const maxMatch = headerText.match(/highest\s+rating\s*(\d+)/i);

  // Stars (e.g. "★★★") → "3★" rank label.
  const stars = $(".rating-star").first().find("span").length;
  const rank = stars > 0 ? `${stars}★` : null;

  // "Fully Solved (N)" / "Total Problems Solved: N" — layout varies by redesign.
  const bodyText = $("body").text();
  const solvedMatch =
    bodyText.match(/Total Problems Solved:\s*(\d+)/i) ?? bodyText.match(/Fully Solved\s*\((\d+)\)/i);

  // Contests participated: the profile lists a "Contests (N)" heading.
  let contests: number | undefined;
  const contestsHeading = bodyText.match(/Contests\s*\((\d+)\)/i);
  if (contestsHeading) contests = Number(contestsHeading[1]);
  if (contests === undefined) {
    // Fallback: the page embeds the full rating history as `all_rating`.
    const ratingArr = $.html().match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
    if (ratingArr) {
      try {
        contests = (JSON.parse(ratingArr[1]) as unknown[]).length;
      } catch {
        contests = undefined;
      }
    }
  }

  const recentSolved = await fetchRecentSolved(handle);

  return {
    rating: Number.isNaN(rating) ? null : rating,
    maxRating: maxMatch ? Number(maxMatch[1]) : null,
    rank,
    problemsSolved: solvedMatch ? Number(solvedMatch[1]) : null,
    extra: { contests, recentSolved },
  };
}
