/**
 * Pre-contest rating trend forecast — the lightweight, "type 2" predictor.
 *
 * Pure functions over a handle's past per-contest deltas (already cached in
 * `ContestResult`). Not a contest prediction: it projects where a user's rating
 * is *trending* using a recency-weighted (EWMA) expected delta plus a volatility
 * band, so the UI can show "you're trending toward ~X (±Y)". No network/DB here.
 */

export type RatingForecast = {
  currentRating: number | null;
  /** Recency-weighted expected change for the next contest. */
  expectedDelta: number | null;
  projectedRating: number | null;
  /** projected ± one standard deviation of recent deltas. */
  low: number | null;
  high: number | null;
  volatility: number | null;
  /** "up" | "down" | "flat" — direction of recent form. */
  trend: "up" | "down" | "flat";
  sampleSize: number;
};

const EMPTY: RatingForecast = {
  currentRating: null,
  expectedDelta: null,
  projectedRating: null,
  low: null,
  high: null,
  volatility: null,
  trend: "flat",
  sampleSize: 0,
};

/** How many most-recent contests feed the forecast. */
const WINDOW = 10;
/** EWMA smoothing — higher = weight recent contests more. */
const ALPHA = 0.4;

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * @param deltas        per-contest rating deltas, OLDEST → NEWEST.
 * @param currentRating rating going into the next contest (last known rating).
 */
export function forecastFromDeltas(
  deltas: number[],
  currentRating: number | null,
): RatingForecast {
  const recent = deltas.slice(-WINDOW);
  if (recent.length === 0) return { ...EMPTY, currentRating };

  let ewma = recent[0];
  for (let i = 1; i < recent.length; i++) {
    ewma = ALPHA * recent[i] + (1 - ALPHA) * ewma;
  }
  const expectedDelta = Math.round(ewma);
  const vol = Math.round(stddev(recent));
  const projected = currentRating != null ? currentRating + expectedDelta : null;

  const trend: RatingForecast["trend"] =
    expectedDelta > 2 ? "up" : expectedDelta < -2 ? "down" : "flat";

  return {
    currentRating,
    expectedDelta,
    projectedRating: projected,
    low: projected != null ? projected - vol : null,
    high: projected != null ? projected + vol : null,
    volatility: vol,
    trend,
    sampleSize: recent.length,
  };
}
