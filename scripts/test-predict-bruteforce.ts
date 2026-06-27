import { Contestant, predict } from "../src/server/predictions/codeforces/predict";
import { binarySearch } from "../src/server/predictions/codeforces/fft";

const MAX = 6000;
const P = (r: number, rb: number) => 1 / (1 + Math.pow(10, (r - rb) / 400));

// Brute-force reference: same algorithm, O(n^2) seed (no FFT).
function brute(cs: Contestant[]): Map<string, number> {
  const eff = cs.map((c) => c.effectiveRating);
  const seedAt = (r: number, exclude: number) =>
    1 + eff.reduce((s, rb) => s + P(r, rb), 0) - P(r, exclude);
  // ranks
  const sorted = [...cs].sort((a, b) => (a.points !== b.points ? b.points - a.points : a.penalty - b.penalty));
  const rank = new Map<string, number>();
  let lp: number | undefined, lpen: number | undefined, rk = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i];
    if (c.points !== lp || c.penalty !== lpen) { lp = c.points; lpen = c.penalty; rk = i + 1; }
    rank.set(c.handle, rk);
  }
  const rankToRating = (rnk: number, self: number) =>
    binarySearch(2, MAX, (rt) => seedAt(rt, self) < rnk) - 1;
  const delta = new Map<string, number>();
  for (const c of cs) {
    const s = seedAt(c.effectiveRating, c.effectiveRating);
    const mid = Math.sqrt(rank.get(c.handle)! * s);
    const need = rankToRating(mid, c.effectiveRating);
    delta.set(c.handle, Math.trunc((need - c.effectiveRating) / 2));
  }
  // adjust
  const byRating = [...cs].sort((a, b) => b.effectiveRating - a.effectiveRating);
  const n = cs.length;
  let sum = byRating.reduce((a, b) => a + delta.get(b.handle)!, 0);
  let inc = Math.trunc(-sum / n) - 1;
  for (const c of cs) delta.set(c.handle, delta.get(c.handle)! + inc);
  const zc = Math.min(4 * Math.round(Math.sqrt(n)), n);
  sum = byRating.slice(0, zc).reduce((a, b) => a + delta.get(b.handle)!, 0);
  inc = Math.min(Math.max(Math.trunc(-sum / zc), -10), 0);
  for (const c of cs) delta.set(c.handle, delta.get(c.handle)! + inc);
  return delta;
}

const N = 500;
const cs: Contestant[] = [];
for (let i = 0; i < N; i++) {
  const rating = Math.round(800 + Math.random() * 2000);
  const points = Math.round(Math.random() * 10000);
  cs.push(new Contestant("u" + i, points, 0, rating));
}
const fft = new Map(predict([...cs], false).map((p) => [p.handle, p.delta!]));
const bf = brute([...cs]);
let maxDiff = 0, sumDiff = 0;
for (const c of cs) {
  const d = Math.abs(fft.get(c.handle)! - bf.get(c.handle)!);
  maxDiff = Math.max(maxDiff, d); sumDiff += d;
}
console.log(`N=${N}  max |fft - brute| = ${maxDiff}  mean = ${(sumDiff / N).toFixed(3)}`);
