/**
 * Platform-neutral shapes for the per-contest results page (`/contests/[id]`):
 * the full ranking with each row's rating change, and the list of questions.
 * Both LeetCode and Codeforces fetchers produce these so the UI is shared.
 */

/** One ranking row, normalized across platforms. */
export type LeaderboardRow = {
  rank: number;
  /** Username (LeetCode) or handle (Codeforces). */
  displayName: string;
  /** Link to the user's profile on the platform. */
  profileUrl: string;
  oldRating: number | null;
  delta: number | null;
  newRating: number | null;
  /** LeetCode contest score / Codeforces points. */
  score: number | null;
};

/** Discriminated so the page can tell "still computing" from "broken". */
export type LeaderboardResult =
  | {
      status: "ok";
      total: number;
      page: number;
      size: number;
      /** true → deltas are OFFICIAL (contest already rated), else predicted. */
      rated: boolean;
      /** When the ranking was crawled (ISO). Set for snapshot sources (LeetCode
       * via lccn-predictor) so the UI can warn that ranks drift as the platform
       * removes flagged accounts. Null/undefined for live sources (Codeforces). */
      crawledAt?: string | null;
      rows: LeaderboardRow[];
    }
  | { status: "computing" }
  | { status: "unavailable" };

/** One contest problem, normalized across platforms. */
export type ContestQuestion = {
  /** Display label: "Q1".."Qn" (LeetCode) or "A".."F" (Codeforces). */
  label: string;
  title: string;
  /** Points the problem is worth (LeetCode credit / Codeforces points). */
  points: number | null;
  /** Codeforces difficulty rating, when published (LeetCode: null). */
  rating: number | null;
  /** Codeforces problem tags (LeetCode: []). */
  tags: string[];
  url: string;
};

export type ContestQuestionsResult = {
  status: "ok" | "unavailable";
  questions: ContestQuestion[];
};
