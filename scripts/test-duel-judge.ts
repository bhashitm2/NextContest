/**
 * Unit checks for the duel judge's pure functions (all formats, ties, draws).
 *   npx tsx scripts/test-duel-judge.ts
 */
import { decideWinner, scoreOf } from "../src/server/duel/judge";
import type { DuelProblem } from "../src/server/duel/select-problems";

const start = new Date("2026-07-02T10:00:00Z");
const end = new Date("2026-07-02T11:00:00Z");
const during = new Date("2026-07-02T10:30:00Z");
const after = new Date("2026-07-02T11:00:01Z");

const iso = (min: number) => new Date(start.getTime() + min * 60_000).toISOString();

function problems(aSolves: (number | null)[], bSolves: (number | null)[]): DuelProblem[] {
  return aSolves.map((a, i) => ({
    key: `k${i}`,
    name: `P${i}`,
    rating: 800,
    url: "#",
    solvedByA: a == null ? null : iso(a),
    solvedByB: bSolves[i] == null ? null : iso(bSolves[i]!),
  }));
}

const base = { challengerId: "A", opponentId: "B", startedAt: start, endsAt: end };

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}\n  got      ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// --- scoreOf ---
check(
  "scoreOf counts + penalty",
  scoreOf(problems([10, 25, null], [null, null, null]), start, "A"),
  { solved: 2, penaltySec: 35 * 60 },
);
check("scoreOf empty", scoreOf(problems([null], [null]), start, "B"), { solved: 0, penaltySec: 0 });

// --- TIMED (winTarget null) ---
const timed = { ...base, winTarget: null };
check("timed: still running mid-duel", decideWinner(timed, problems([10], [null]), during), {
  finished: false, winnerId: null, draw: false, finishedAt: null,
});
check("timed: more solves wins", decideWinner(timed, problems([10, 20], [15, null]), after), {
  finished: true, winnerId: "A", draw: false, finishedAt: end,
});
check("timed: tie broken by penalty", decideWinner(timed, problems([10, null], [5, null]), after), {
  finished: true, winnerId: "B", draw: false, finishedAt: end,
});
check("timed: 0-0 draw", decideWinner(timed, problems([null], [null]), after), {
  finished: true, winnerId: null, draw: true, finishedAt: end,
});
check(
  "timed: equal solves equal penalty draw",
  decideWinner(timed, problems([10, null], [null, 10]), after),
  { finished: true, winnerId: null, draw: true, finishedAt: end },
);

// --- FIRST_SOLVE (winTarget 1) ---
const first = { ...base, winTarget: 1 };
check("first: earliest AC wins immediately", decideWinner(first, problems([12, null], [20, null]), during), {
  finished: true, winnerId: "A", draw: false, finishedAt: new Date(iso(12)),
});
check("first: only B solved", decideWinner(first, problems([null], [7]), during), {
  finished: true, winnerId: "B", draw: false, finishedAt: new Date(iso(7)),
});
check("first: same second draw", decideWinner(first, problems([9], [9]), during), {
  finished: true, winnerId: null, draw: true, finishedAt: new Date(iso(9)),
});
check("first: nobody solved, clock out => draw", decideWinner(first, problems([null], [null]), after), {
  finished: true, winnerId: null, draw: true, finishedAt: end,
});

// --- RACE (winTarget = problemCount) ---
const race = { ...base, winTarget: 3 };
check("race: not there yet", decideWinner(race, problems([5, 10, null], [4, null, null]), during), {
  finished: false, winnerId: null, draw: false, finishedAt: null,
});
check(
  "race: B finishes all first",
  decideWinner(race, problems([5, 10, null], [4, 8, 20]), during),
  { finished: true, winnerId: "B", draw: false, finishedAt: new Date(iso(20)) },
);
check(
  "race: both complete this poll — earlier 3rd solve wins",
  decideWinner(race, problems([5, 10, 30], [4, 8, 29]), during),
  { finished: true, winnerId: "B", draw: false, finishedAt: new Date(iso(29)) },
);
check(
  "race: clock out before target => timed scoring",
  decideWinner(race, problems([5, 10, null], [4, null, null]), after),
  { finished: true, winnerId: "A", draw: false, finishedAt: end },
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll judge checks passed.");
