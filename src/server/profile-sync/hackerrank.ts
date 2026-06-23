import { fetchJson, type ProfileStats } from "./types";

// HackerRank is a profile-only platform: we surface "question completion" as the
// total problems solved across all skill badges. Public REST API (no auth);
// HackerRank rejects non-browser User-Agents, so present a browser UA.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": BROWSER_UA };

const BADGES = (h: string) =>
  `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(h)}/badges`;
const PROFILE = (h: string) =>
  `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(h)}/profile`;

type Badge = { solved?: number; total_stars?: number };
type BadgesResp = { status?: boolean; models?: Badge[] };
type ProfileResp = { model?: { username?: string; name?: string } };

/** Pure: total problems solved = sum of `solved` across all skill badges. */
export function parseHackerRankStats(badges: BadgesResp): ProfileStats {
  const models = badges.models ?? [];
  const solved = models.reduce((sum, b) => sum + (b.solved ?? 0), 0);
  return {
    rating: null,
    maxRating: null,
    rank: null, // HackerRank has no single tier; stars are per-domain
    problemsSolved: models.length ? solved : null,
    extra: {}, // no easy/medium/hard split
  };
}

async function getProfile(handle: string): Promise<ProfileResp> {
  return fetchJson<ProfileResp>(PROFILE(handle), { headers: HEADERS });
}

/** Confirm the handle exists (the profile endpoint 404s for unknown users). */
export async function validateHackerRank(handle: string): Promise<string> {
  const json = await getProfile(handle); // throws on non-2xx → "not found"
  return json.model?.username ?? handle;
}

/** Text to scan for the verification token — the editable display Name. */
export async function fetchHackerRankVerificationField(handle: string): Promise<string> {
  const json = await getProfile(handle);
  return json.model?.name ?? "";
}

/** Full per-user stats (question completion across skill badges). */
export async function fetchHackerRankStats(handle: string): Promise<ProfileStats> {
  const badges = await fetchJson<BadgesResp>(BADGES(handle), { headers: HEADERS });
  return parseHackerRankStats(badges);
}
