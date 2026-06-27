/**
 * Correctness gate for the Codeforces predictor port.
 *
 * Takes a PAST, already-rated Codeforces contest, feeds its standings + each
 * participant's REAL pre-contest rating into our ported predictor, and compares
 * the predicted deltas against Codeforces' official `contest.ratingChanges`.
 * A faithful port matches the official numbers almost exactly.
 *
 *   npx tsx scripts/verify-cf-predict.ts [contestId]
 *
 * With no contestId it auto-picks the most recent finished, rated round.
 */
import { Contestant, predict } from "../src/server/predictions/codeforces/predict";

const API = "https://codeforces.com/api";

type CfRow = {
  party: { members: { handle: string }[]; participantType: string; ghost: boolean };
  points: number;
  penalty: number;
};
type StandingsResp = {
  status: string;
  result?: { contest: { id: number; name: string; phase: string }; rows: CfRow[] };
};
type RatingChange = { handle: string; oldRating: number; newRating: number; rank: number };
type RatingChangesResp = { status: string; result?: RatingChange[] };
type ContestListResp = { status: string; result?: { id: number; phase: string; name: string }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  // CF rate-limits aggressively (~1 req / 2s); retry on 4xx/5xx with backoff.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "NextContest-verify/0.1" } });
    if (res.ok) return (await res.json()) as T;
    const body = await res.text().catch(() => "");
    if (attempt < 3 && (res.status === 503 || /limit/i.test(body))) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url} — ${body.slice(0, 160)}`);
  }
  throw new Error(`exhausted retries for ${url}`);
}

async function getRatingChanges(contestId: number): Promise<RatingChange[] | null> {
  try {
    const j = await getJson<RatingChangesResp>(`${API}/contest.ratingChanges?contestId=${contestId}`);
    return j.status === "OK" && j.result && j.result.length > 0 ? j.result : null;
  } catch {
    return null;
  }
}

async function pickRatedContest(): Promise<number> {
  const list = await getJson<ContestListResp>(`${API}/contest.list?gym=false`);
  const finished = (list.result ?? []).filter((c) => c.phase === "FINISHED").slice(0, 8);
  for (const c of finished) {
    await sleep(2000); // pace requests to stay under CF's call limit
    if (await getRatingChanges(c.id)) return c.id;
  }
  throw new Error("Could not find a recent rated contest; pass a contestId explicitly.");
}

async function main() {
  const arg = process.argv[2];
  const contestId = arg ? Number(arg) : await pickRatedContest();

  // Sequenced (not Promise.all) to stay under Codeforces' call limit.
  // Only `contestId` is allowed for non-gym standings (extra params → 400).
  const standings = await getJson<StandingsResp>(
    `${API}/contest.standings?contestId=${contestId}`,
  );
  await sleep(2000);
  const official = await getRatingChanges(contestId);
  if (standings.status !== "OK" || !standings.result) throw new Error("standings unavailable");
  if (!official) throw new Error(`contest ${contestId} is not rated`);

  console.log(`Contest ${contestId}: ${standings.result.contest.name}`);

  const oldOf = new Map<string, number>();
  const officialDelta = new Map<string, number>();
  for (const rc of official) {
    oldOf.set(rc.handle.toLowerCase(), rc.oldRating);
    officialDelta.set(rc.handle.toLowerCase(), rc.newRating - rc.oldRating);
  }

  const contestants = standings.result.rows
    .filter((r) => r.party.participantType === "CONTESTANT" && r.party.members.length === 1 && !r.party.ghost)
    .map((r) => {
      const handle = r.party.members[0].handle;
      const old = oldOf.get(handle.toLowerCase());
      // CF reports oldRating 0 for DEBUT accounts; internally they're seeded at
      // the default rating, so pass null (→ DEFAULT_RATING) exactly like prod.
      return new Contestant(handle, r.points, r.penalty, old && old > 0 ? old : null);
    })
    .filter((c) => oldOf.has(c.handle.toLowerCase())); // only officially-rated participants

  const t0 = Date.now();
  const preds = predict(contestants, false);
  const ms = Date.now() - t0;

  // Track established (had a real prior rating) separately from debut accounts.
  // CF applies a special first-contest boost that the standard Mirzayanov/TLE/
  // Carrot algorithm intentionally does NOT model, so debuts always diverge.
  const estErrs: number[] = [];
  const allErrs: number[] = [];
  let estWithin10 = 0;
  let debuts = 0;
  const worst: { handle: string; predicted: number; actual: number }[] = [];
  for (const p of preds) {
    const actual = officialDelta.get(p.handle.toLowerCase());
    if (actual == null || p.delta == null) continue;
    const err = Math.abs(p.delta - actual);
    allErrs.push(err);
    const established = (oldOf.get(p.handle.toLowerCase()) ?? 0) > 0;
    if (established) {
      estErrs.push(err);
      if (err <= 10) estWithin10++;
    } else {
      debuts++;
      if (err > 0) worst.push({ handle: p.handle, predicted: p.delta, actual });
    }
  }
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const n = allErrs.length;
  const ne = estErrs.length;

  console.log(`\nContestants compared: ${n}  (established ${ne}, debuts ${debuts})`);
  console.log(`Predicted in:         ${ms}ms`);
  console.log(`\nEstablished users (oldRating > 0) — the real correctness gate:`);
  console.log(`  Within ±10:        ${estWithin10}/${ne} (${((100 * estWithin10) / ne).toFixed(1)}%)`);
  console.log(`  Median abs error:  ${med(estErrs)}`);
  console.log(`  Mean abs error:    ${(estErrs.reduce((a, b) => a + b, 0) / ne).toFixed(2)}`);
  console.log(`\nAll users (incl. debut tail): median ${med(allErrs)}`);
  if (worst.length > 0) {
    worst.sort((a, b) => Math.abs(b.predicted - b.actual) - Math.abs(a.predicted - a.actual));
    console.log(`\nLargest debut mismatches (expected — CF's newcomer boost is not modelled):`);
    for (const w of worst.slice(0, 3)) {
      console.log(`  ${w.handle}: predicted ${w.predicted >= 0 ? "+" : ""}${w.predicted}, actual ${w.actual >= 0 ? "+" : ""}${w.actual}`);
    }
  }

  const PASS = med(estErrs) <= 2 && estWithin10 / ne >= 0.85;
  console.log(`\n${PASS ? "PASS ✅" : "FAIL ❌"} (gate: established median ≤ 2 and ≥ 85% within ±10)`);
  process.exit(PASS ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
