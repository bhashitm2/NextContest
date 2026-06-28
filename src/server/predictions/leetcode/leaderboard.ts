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

/** One ranklist row, normalized for the UI. */
export type LeaderboardRow = {
  rank: number;
  username: string;
  userSlug: string;
  dataRegion: string | null;
  oldRating: number | null;
  delta: number | null;
  newRating: number | null;
  score: number | null;
  /** ISO timestamp the contestant finished (penalty time), if known. */
  finishTime: string | null;
};

/** Discriminated result so the page can tell "still computing" from "broken". */
export type LeaderboardResult =
  | { status: "ok"; total: number; page: number; size: number; rows: LeaderboardRow[] }
  | { status: "computing" }
  | { status: "unavailable" };

type PredictionRecord = {
  rank?: number | null;
  username?: string | null;
  user_slug?: string | null;
  data_region?: string | null;
  old_rating?: number | null;
  delta_rating?: number | null;
  new_rating?: number | null;
  score?: number | null;
  finish_time?: string | null;
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
  return {
    rank: rec.rank ?? 0,
    username: rec.username ?? rec.user_slug ?? "?",
    userSlug: rec.user_slug ?? rec.username ?? "",
    dataRegion: rec.data_region ?? null,
    oldRating: round(rec.old_rating),
    delta: round(rec.delta_rating),
    newRating: round(rec.new_rating),
    score: rec.score ?? null,
    finishTime: rec.finish_time ?? null,
  };
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

  const url =
    `${base.replace(/\/$/, "")}/api/v1/contest/${encodeURIComponent(slug)}/predict` +
    `?page=${page}&size=${size}&sort=rank`;

  try {
    // Generous timeout: a free-tier host may cold-start (~1 min) on first hit.
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
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
      rows: (data.records ?? []).map(toRow),
    };
  } catch {
    return { status: "unavailable" };
  }
}
