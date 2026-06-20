import * as cheerio from "cheerio";

import { fetchJson, type ProfileStats, type RecentSolved, USER_AGENT } from "./types";

const KENKO = "https://kenkoooo.com/atcoder/atcoder-api";
const KENKO_RES = "https://kenkoooo.com/atcoder/resources";
const PROFILE = (h: string) => `https://atcoder.jp/users/${encodeURIComponent(h)}`;
const HISTORY = (h: string) => `https://atcoder.jp/users/${encodeURIComponent(h)}/history/json`;

type UserInfo = { user_id: string; accepted_count: number };
type Submission = { epoch_second: number; problem_id: string; contest_id: string; result: string };
type ProblemMeta = { id: string; name?: string; title?: string };

async function kenkoUserInfo(handle: string): Promise<UserInfo | null> {
  try {
    return await fetchJson<UserInfo>(`${KENKO}/v2/user_info?user=${encodeURIComponent(handle)}`);
  } catch {
    return null;
  }
}

/** Number of contests the user has participated in (official history endpoint). */
async function contestCount(handle: string): Promise<number | undefined> {
  try {
    const arr = await fetchJson<unknown[]>(HISTORY(handle));
    return Array.isArray(arr) ? arr.length : undefined;
  } catch {
    return undefined;
  }
}

// Problem id → human title map (kenkoooo resource), cached in memory for a day.
let problemTitles: Map<string, string> | null = null;
let problemTitlesAt = 0;
async function getProblemTitles(): Promise<Map<string, string>> {
  if (problemTitles && Date.now() - problemTitlesAt < 24 * 60 * 60 * 1000) return problemTitles;
  try {
    const arr = await fetchJson<ProblemMeta[]>(`${KENKO_RES}/problems.json`);
    problemTitles = new Map(arr.map((p) => [p.id, p.name ?? p.title ?? p.id]));
    problemTitlesAt = Date.now();
  } catch {
    problemTitles = problemTitles ?? new Map();
  }
  return problemTitles;
}

// Problem id → estimated difficulty (kenkoooo IRT model), cached for a day.
let problemDiff: Map<string, number> | null = null;
let problemDiffAt = 0;
async function getProblemDifficulties(): Promise<Map<string, number>> {
  if (problemDiff && Date.now() - problemDiffAt < 24 * 60 * 60 * 1000) return problemDiff;
  try {
    const obj = await fetchJson<Record<string, { difficulty?: number }>>(
      `${KENKO_RES}/problem-models.json`,
    );
    const map = new Map<string, number>();
    for (const [id, m] of Object.entries(obj)) {
      if (typeof m.difficulty === "number") map.set(id, m.difficulty);
    }
    problemDiff = map;
    problemDiffAt = Date.now();
  } catch {
    problemDiff = problemDiff ?? new Map();
  }
  return problemDiff;
}

/** Bucket an AtCoder estimated difficulty into easy/medium/hard (color tiers). */
function diffBucket(d: number): "easy" | "medium" | "hard" {
  if (d < 800) return "easy"; // gray / brown
  if (d < 2000) return "medium"; // green / cyan / blue
  return "hard"; // yellow and above
}

/** AtCoder rank: prefer the "N Kyu / N Dan" label, fall back to the color tier. */
function scrapeRank($: cheerio.CheerioAPI): string | null {
  const kyu = $("#main-container").text().match(/\b\d+\s*(?:Kyu|Dan)\b/i);
  if (kyu) return kyu[0].replace(/\s+/g, " ");
  const cls = $(".username span").first().attr("class")?.match(/user-([a-z]+)/i)?.[1];
  return cls ? cls.charAt(0).toUpperCase() + cls.slice(1) : null;
}

/** Load the AtCoder profile HTML (used for rating + verification scraping). */
async function loadProfile(handle: string): Promise<cheerio.CheerioAPI> {
  const res = await fetch(PROFILE(handle), {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw new Error("AtCoder handle not found");
  if (!res.ok) throw new Error(`AtCoder HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

/** Read the first integer from the profile table row whose <th> matches `label`.
 * (Cells like "Highest Rating" hold "4229 (date…)" — take just the number.) */
function tableInt($: cheerio.CheerioAPI, label: string): number | null {
  let value: number | null = null;
  $("table th").each((_, th) => {
    if ($(th).text().trim().toLowerCase() === label.toLowerCase()) {
      const m = $(th).next("td").text().match(/-?\d+/);
      if (m) value = Number(m[0]);
    }
  });
  return value;
}

/** Pure: does any submission match the problem + CE verdict + time≥since? */
export function acHasCompileError(
  subs: Submission[],
  problemId: string,
  sinceSec: number,
): boolean {
  return subs.some(
    (s) => s.problem_id === problemId && s.result === "CE" && s.epoch_second >= sinceSec,
  );
}

/** True if `handle` has a fresh Compile Error submission to `problemId` (kenkoooo). */
export async function findAtCoderCompileError(
  handle: string,
  problemId: string,
  sinceSec: number,
): Promise<boolean> {
  let subs: Submission[] = [];
  try {
    subs = await fetchJson<Submission[]>(
      `${KENKO}/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${Math.floor(sinceSec)}`,
    );
  } catch {
    subs = [];
  }
  return acHasCompileError(subs, problemId, sinceSec);
}

export async function validateAtCoder(handle: string): Promise<string> {
  await loadProfile(handle); // throws on 404
  return handle;
}

/** Profile text to scan for the verification token (Affiliation / self-intro). */
export async function fetchAtCoderVerificationField(handle: string): Promise<string> {
  const $ = await loadProfile(handle);
  return $("#main-container").text();
}

/** Full per-user stats: kenkoooo for solves, profile scrape for rating. */
export async function fetchAtCoderStats(handle: string): Promise<ProfileStats> {
  const $ = await loadProfile(handle); // also validates existence
  const rating = tableInt($, "Rating");
  const maxRating = tableInt($, "Highest Rating");

  const info = await kenkoUserInfo(handle);
  let submissions: Submission[] = [];
  try {
    submissions = await fetchJson<Submission[]>(
      `${KENKO}/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=0`,
    );
  } catch {
    submissions = [];
  }

  // First AC per distinct problem.
  const firstAc = new Map<string, Submission>();
  for (const s of submissions) {
    if (s.result !== "AC") continue;
    const prev = firstAc.get(s.problem_id);
    if (!prev || s.epoch_second < prev.epoch_second) firstAc.set(s.problem_id, s);
  }
  const solved = [...firstAc.values()];

  const diffs = await getProblemDifficulties();
  const difficulty = { easy: 0, medium: 0, hard: 0 };
  for (const s of solved) {
    const d = diffs.get(s.problem_id);
    if (d !== undefined) difficulty[diffBucket(d)] += 1;
  }

  const titles = await getProblemTitles();
  const recentSolved: RecentSolved[] = solved
    .sort((a, b) => b.epoch_second - a.epoch_second)
    .slice(0, 10)
    .map((s) => ({
      title: titles.get(s.problem_id) ?? s.problem_id,
      url: `https://atcoder.jp/contests/${s.contest_id}/tasks/${s.problem_id}`,
      at: new Date(s.epoch_second * 1000).toISOString(),
    }));

  const contests = await contestCount(handle);

  return {
    rating,
    maxRating,
    rank: scrapeRank($),
    // Prefer kenkoooo's count; fall back to distinct AC from submissions.
    problemsSolved: info?.accepted_count ?? (solved.length || null),
    extra: { difficulty, contests, recentSolved },
  };
}
