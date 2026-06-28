/**
 * LeetCode full-contest leaderboard, served by the self-hosted lccn-predictor
 * fork (the bhashitm2/lccn-predictor service) via `LCCN_PREDICTOR_URL`.
 *
 * Unlike the per-user prediction in `./fetch.ts`, this returns the whole ranklist
 * (paginated), each row carrying the predicted rating change. It powers the
 * contest-first results page (`/contests/[id]`).
 *
 * API used: GET {base}/api/v1/contest/{slug}/predict?page=&size=&sort=rank
 *   200 → PredictionPage { slug, status, total, page, size, records: [...] }
 *   202 → contest crawled but predictions still computing (try again shortly)
 *   else / no URL / cold-start / timeout → unavailable (caller degrades gracefully)
 */
import type { LeaderboardResult, LeaderboardRow } from "../contest-results";

type PredictionRecord = {
  rank?: number | null;
  username?: string | null;
  user_slug?: string | null;
  old_rating?: number | null;
  delta_rating?: number | null;
  new_rating?: number | null;
  score?: number | null;
};

type PredictionPage = {
  slug?: string;
  status?: string;
  total?: number;
  page?: number;
  size?: number;
  records?: PredictionRecord[];
};

function round(n: number | null | undefined): number | null {
  return n == null ? null : Math.round(n);
}

function toRow(rec: PredictionRecord): LeaderboardRow {
  const slug = rec.user_slug ?? rec.username ?? "";
  return {
    rank: rec.rank ?? 0,
    displayName: rec.username ?? rec.user_slug ?? "?",
    profileUrl: `https://leetcode.com/u/${encodeURIComponent(slug)}/`,
    oldRating: round(rec.old_rating),
    delta: round(rec.delta_rating),
    newRating: round(rec.new_rating),
    score: rec.score ?? null,
  };
}

/** When the service crawled this contest's ranking (ISO, or null). Drives the
 * UI's "snapshot from …" note, since LeetCode keeps purging flagged accounts
 * after the crawl so ranks drift until the round is finally rated. */
async function fetchCrawledAt(root: string, slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${root}/api/v1/contest/${encodeURIComponent(slug)}/status`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const s = (await res.json()) as { predicted_at?: string | null };
    return s.predicted_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch one page of a LeetCode contest's predicted ranklist. `slug` is the
 * contest's `externalId` (e.g. "weekly-contest-508"). Never throws.
 */
export async function fetchLeetCodeLeaderboard(
  slug: string,
  page: number,
  size: number,
): Promise<LeaderboardResult> {
  const base = process.env.LCCN_PREDICTOR_URL;
  if (!base) return { status: "unavailable" };

  const root = base.replace(/\/$/, "");
  const url =
    `${root}/api/v1/contest/${encodeURIComponent(slug)}/predict` +
    `?page=${page}&size=${size}&sort=rank`;

  try {
    // Generous timeout: a free-tier host may cold-start (~1 min) on first hit.
    // The snapshot time comes from /status in parallel (best-effort).
    const [res, crawledAt] = await Promise.all([
      fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000) }),
      fetchCrawledAt(root, slug),
    ]);
    if (res.status === 202) return { status: "computing" };
    if (!res.ok) return { status: "unavailable" };

    const data = (await res.json()) as PredictionPage;
    // Some builds answer 200 with status:"pending"/"crawling" before records exist.
    if (!Array.isArray(data.records) || data.records.length === 0) {
      const s = (data.status ?? "").toLowerCase();
      if (s && s !== "done") return { status: "computing" };
    }
    return {
      status: "ok",
      total: data.total ?? data.records?.length ?? 0,
      page: data.page ?? page,
      size: data.size ?? size,
      // lccn delta becomes the official number once LeetCode rates; we always
      // present it as "predicted" since the service can't tell us which.
      rated: false,
      crawledAt,
      rows: (data.records ?? []).map(toRow),
    };
  } catch {
    return { status: "unavailable" };
  }
}
