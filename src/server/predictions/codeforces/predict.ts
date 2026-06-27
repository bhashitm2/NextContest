/**
 * Codeforces rating-change prediction.
 *
 * Faithful TypeScript port of Carrot's `carrot/src/background/predict.js`
 * (https://github.com/meooow25/carrot, MIT License), which itself adapts TLE
 * (https://github.com/cheran-senthil/TLE) and Mike Mirzayanov's original
 * Codeforces rating algorithm. Uses FFT convolution so the cost is independent
 * of the number of contestants — a 30k-person round still computes in well
 * under a second.
 *
 * Pure computation: no network, no DB. Given each contestant's (points, penalty,
 * pre-contest rating) it returns the predicted delta and "performance" (the
 * rating at which the delta would be zero).
 */
import { FFTConv, binarySearch } from "./fft";

const DEFAULT_RATING = 1400;

export const MAX_RATING_LIMIT = 6000;
export const MIN_RATING_LIMIT = -500;
const RATING_RANGE_LEN = MAX_RATING_LIMIT - MIN_RATING_LIMIT;
const ELO_OFFSET = RATING_RANGE_LEN;
const RATING_OFFSET = -MIN_RATING_LIMIT;

const ELO_WIN_PROB: number[] = new Array(2 * RATING_RANGE_LEN + 1);
for (let i = -RATING_RANGE_LEN; i <= RATING_RANGE_LEN; i++) {
  ELO_WIN_PROB[i + ELO_OFFSET] = 1 / (1 + Math.pow(10, i / 400));
}

const fftConv = new FFTConv(ELO_WIN_PROB.length + RATING_RANGE_LEN - 1);

export class Contestant {
  readonly handle: string;
  readonly points: number;
  readonly penalty: number;
  readonly rating: number | null;
  readonly effectiveRating: number;

  rank: number | null = null;
  delta: number | null = null;
  performance: number | null = null;

  constructor(handle: string, points: number, penalty: number, rating: number | null) {
    this.handle = handle;
    this.points = points;
    this.penalty = penalty;
    this.rating = rating;
    this.effectiveRating = rating == null ? DEFAULT_RATING : rating;
  }
}

export type PredictResult = {
  handle: string;
  rating: number | null;
  rank: number | null;
  delta: number | null;
  /** Rating at which the delta would be zero. `Infinity` for rank 1. */
  performance: number | null;
};

class RatingCalculator {
  private readonly contestants: Contestant[];
  private seed: number[] = [];
  private adjustment = 0;

  constructor(contestants: Contestant[]) {
    this.contestants = contestants;
  }

  calculateDeltas(calcPerfs: boolean): void {
    this.calcSeed();
    this.reassignRanks();
    this.calcDeltas();
    this.adjustDeltas();
    if (calcPerfs) {
      this.calcPerfs();
    }
  }

  private calcSeed(): void {
    const counts = new Array<number>(RATING_RANGE_LEN).fill(0);
    for (const c of this.contestants) {
      counts[c.effectiveRating + RATING_OFFSET] += 1;
    }
    this.seed = fftConv.convolve(ELO_WIN_PROB, counts);
    for (let i = 0; i < this.seed.length; i++) {
      this.seed[i] += 1;
    }
  }

  private getSeed(r: number, exclude: number): number {
    return this.seed[r + ELO_OFFSET + RATING_OFFSET] - ELO_WIN_PROB[r - exclude + ELO_OFFSET];
  }

  private reassignRanks(): void {
    this.contestants.sort((a, b) =>
      a.points !== b.points ? b.points - a.points : a.penalty - b.penalty,
    );
    let lastPoints: number | undefined;
    let lastPenalty: number | undefined;
    let rank = 0;
    for (let i = this.contestants.length - 1; i >= 0; i--) {
      const c = this.contestants[i];
      if (c.points !== lastPoints || c.penalty !== lastPenalty) {
        lastPoints = c.points;
        lastPenalty = c.penalty;
        rank = i + 1;
      }
      c.rank = rank;
    }
  }

  private calcDelta(c: Contestant, assumedRating: number): number {
    const seed = this.getSeed(assumedRating, c.effectiveRating);
    const midRank = Math.sqrt((c.rank ?? 1) * seed);
    const needRating = this.rankToRating(midRank, c.effectiveRating);
    return Math.trunc((needRating - assumedRating) / 2);
  }

  private calcDeltas(): void {
    for (const c of this.contestants) {
      c.delta = this.calcDelta(c, c.effectiveRating);
    }
  }

  private rankToRating(rank: number, selfRating: number): number {
    return (
      binarySearch(
        2,
        MAX_RATING_LIMIT,
        (rating) => this.getSeed(rating, selfRating) < rank,
      ) - 1
    );
  }

  private adjustDeltas(): void {
    this.contestants.sort((a, b) => b.effectiveRating - a.effectiveRating);
    const n = this.contestants.length;
    {
      const deltaSum = this.contestants.reduce((a, b) => a + (b.delta ?? 0), 0);
      const inc = Math.trunc(-deltaSum / n) - 1;
      this.adjustment = inc;
      for (const c of this.contestants) {
        c.delta = (c.delta ?? 0) + inc;
      }
    }
    {
      const zeroSumCount = Math.min(4 * Math.round(Math.sqrt(n)), n);
      const deltaSum = this.contestants
        .slice(0, zeroSumCount)
        .reduce((a, b) => a + (b.delta ?? 0), 0);
      const inc = Math.min(Math.max(Math.trunc(-deltaSum / zeroSumCount), -10), 0);
      this.adjustment += inc;
      for (const c of this.contestants) {
        c.delta = (c.delta ?? 0) + inc;
      }
    }
  }

  private calcPerfs(): void {
    for (const c of this.contestants) {
      if (c.rank === 1) {
        c.performance = Infinity;
      } else {
        c.performance = binarySearch(
          MIN_RATING_LIMIT,
          MAX_RATING_LIMIT,
          (assumedRating) => this.calcDelta(c, assumedRating) + this.adjustment <= 0,
        );
      }
    }
  }
}

/** Compute predicted deltas (and optionally performance) for all contestants.
 * Mutates nothing the caller passed beyond returning fresh result objects. */
export function predict(contestants: Contestant[], calcPerfs = false): PredictResult[] {
  new RatingCalculator(contestants).calculateDeltas(calcPerfs);
  return contestants.map((c) => ({
    handle: c.handle,
    rating: c.rating,
    rank: c.rank,
    delta: c.delta,
    performance: c.performance,
  }));
}
