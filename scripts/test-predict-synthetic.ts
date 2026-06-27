import { Contestant, predict } from "../src/server/predictions/codeforces/predict";

// 5 equal-rated contestants, strictly ordered (ranks 1..5). Expect: rank1 gains,
// rank5 loses, monotonic, sum ~ 0.
const cs = [
  new Contestant("p1", 500, 0, 1500),
  new Contestant("p2", 400, 0, 1500),
  new Contestant("p3", 300, 0, 1500),
  new Contestant("p4", 200, 0, 1500),
  new Contestant("p5", 100, 0, 1500),
];
const res = predict(cs, false);
res.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0)); // print best first by reversing later
for (const r of res) {
  console.log(`${r.handle}: rating ${r.rating}, rank ${r.rank}, delta ${r.delta! >= 0 ? "+" : ""}${r.delta}`);
}
console.log("sum delta:", res.reduce((a, b) => a + (b.delta ?? 0), 0));
