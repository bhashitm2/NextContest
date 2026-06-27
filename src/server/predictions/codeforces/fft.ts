/**
 * Convolution of real sequences via Cooley–Tukey FFT in O(n log n).
 *
 * Faithful TypeScript port of Carrot's `carrot/src/util/conv.js`
 * (https://github.com/meooow25/carrot, MIT License). Used to compute the
 * Codeforces "seed" (expected rank) for every possible rating in one pass,
 * which makes rating prediction independent of the number of contestants.
 */
export class FFTConv {
  private readonly n: number;
  private readonly wr: number[] = [];
  private readonly wi: number[] = [];
  private readonly rev: number[] = [0];

  constructor(n: number) {
    let k = 1;
    while (1 << k < n) {
      k++;
    }
    this.n = 1 << k;
    const n2 = this.n >> 1;
    const ang = (2 * Math.PI) / this.n;
    for (let i = 0; i < n2; i++) {
      this.wr[i] = Math.cos(i * ang);
      this.wi[i] = Math.sin(i * ang);
    }
    for (let i = 1; i < this.n; i++) {
      this.rev[i] = (this.rev[i >> 1] >> 1) | ((i & 1) << (k - 1));
    }
  }

  private reverse(a: number[]): void {
    for (let i = 1; i < this.n; i++) {
      if (i < this.rev[i]) {
        const tmp = a[i];
        a[i] = a[this.rev[i]];
        a[this.rev[i]] = tmp;
      }
    }
  }

  private transform(ar: number[], ai: number[]): void {
    this.reverse(ar);
    this.reverse(ai);
    const { wr, wi } = this;
    for (let len = 2; len <= this.n; len <<= 1) {
      const half = len >> 1;
      const diff = this.n / len;
      for (let i = 0; i < this.n; i += len) {
        let pw = 0;
        for (let j = i; j < i + half; j++) {
          const k = j + half;
          const vr = ar[k] * wr[pw] - ai[k] * wi[pw];
          const vi = ar[k] * wi[pw] + ai[k] * wr[pw];
          ar[k] = ar[j] - vr;
          ai[k] = ai[j] - vi;
          ar[j] += vr;
          ai[j] += vi;
          pw += diff;
        }
      }
    }
  }

  convolve(a: number[], b: number[]): number[] {
    if (a.length === 0 || b.length === 0) {
      return [];
    }
    const n = this.n;
    const resLen = a.length + b.length - 1;
    if (resLen > n) {
      throw new Error(
        `a.length + b.length - 1 is ${a.length} + ${b.length} - 1 = ${resLen}, expected <= ${n}`,
      );
    }
    const cr = new Array<number>(n).fill(0);
    const ci = new Array<number>(n).fill(0);
    cr.splice(0, a.length, ...a);
    ci.splice(0, b.length, ...b);
    this.transform(cr, ci);

    cr[0] = 4 * cr[0] * ci[0];
    ci[0] = 0;
    for (let i = 1, j = n - 1; i <= j; i++, j--) {
      const ar = cr[i] + cr[j];
      const ai = ci[i] - ci[j];
      const br = ci[j] + ci[i];
      const bi = cr[j] - cr[i];
      cr[i] = ar * br - ai * bi;
      ci[i] = ar * bi + ai * br;
      cr[j] = cr[i];
      ci[j] = -ci[i];
    }

    this.transform(cr, ci);
    const res: number[] = [];
    res[0] = cr[0] / (4 * n);
    for (let i = 1, j = n - 1; i <= j; i++, j--) {
      res[i] = cr[j] / (4 * n);
      res[j] = cr[i] / (4 * n);
    }
    res.splice(resLen);
    return res;
  }
}

/** Binary search on integers in [left, right) for the first value where
 * `predicate` is true. Port of Carrot's `carrot/src/util/binsearch.js`. */
export function binarySearch(
  left: number,
  right: number,
  predicate: (mid: number) => boolean,
): number {
  if (left > right) {
    throw new Error(`left ${left} must be <= right ${right}`);
  }
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (predicate(mid)) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  return left;
}
