/**
 * Server-side E2E for Problem Duels against the shared DB + live CF API.
 * Exercises the real tRPC procedures via createCaller for the two test
 * accounts, then cleans up every duel it created.
 *
 *   npx tsx scripts/test-duel-e2e.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { checkDuel, parseProblems } from "../src/server/duel/judge";
import { createCaller } from "../src/server/routers/_app";

const CHALLENGER_USERNAME = "bhashit007"; // CF Kakarotto007
const OPPONENT_USERNAME = "bkb"; // CF bhashkarkumar2063

let failures = 0;
function assert(cond: boolean, name: string, detail?: unknown) {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

const createdDuelIds: string[] = [];

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { in: [CHALLENGER_USERNAME, OPPONENT_USERNAME] } },
    select: { id: true, username: true },
  });
  const challenger = users.find((u) => u.username === CHALLENGER_USERNAME);
  const opponent = users.find((u) => u.username === OPPONENT_USERNAME);
  if (!challenger || !opponent) throw new Error("test users not found");

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: challenger.id, addresseeId: opponent.id },
        { requesterId: opponent.id, addresseeId: challenger.id },
      ],
    },
  });
  if (!friendship) throw new Error("test users are not friends — cannot run E2E");
  console.log(`Using ${CHALLENGER_USERNAME} vs ${OPPONENT_USERNAME} (friends ✓)`);

  const asChallenger = createCaller({ db: prisma, userId: challenger.id, headers: new Headers() });
  const asOpponent = createCaller({ db: prisma, userId: opponent.id, headers: new Headers() });

  // --- eligibleOpponents ---
  const elig = await asChallenger.duel.eligibleOpponents();
  assert(!!elig.me?.handle, "challenger has verified CF handle");
  assert(
    elig.friends.some((f) => f.username === OPPONENT_USERNAME),
    "opponent appears in eligibleOpponents",
  );

  // --- create (happy path) ---
  const duel = await asChallenger.duel.create({
    username: OPPONENT_USERNAME,
    format: "FIRST_SOLVE",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 900,
  });
  createdDuelIds.push(duel.id);
  assert(duel.status === "PENDING" && duel.winTarget === 1 && duel.problemCount === 3, "create → PENDING FIRST_SOLVE quick", duel);

  // --- badge + list ---
  const pending = await asOpponent.duel.pendingCount();
  assert(pending >= 1, "opponent pendingCount ≥ 1");
  const oppList = await asOpponent.duel.list();
  assert(oppList.incoming.some((d) => d.id === duel.id), "invite in opponent's incoming");

  // --- duplicate pair → CONFLICT ---
  try {
    await asChallenger.duel.create({
      username: OPPONENT_USERNAME, format: "TIMED", preset: "QUICK", ratingMin: 800, ratingMax: 1200,
    });
    assert(false, "duplicate pair rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "CONFLICT", "duplicate pair rejected (CONFLICT)");
  }

  // --- reverse-direction duplicate also blocked ---
  try {
    await asOpponent.duel.create({
      username: CHALLENGER_USERNAME, format: "TIMED", preset: "QUICK", ratingMin: 800, ratingMax: 1200,
    });
    assert(false, "reverse duplicate rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "CONFLICT", "reverse duplicate rejected (CONFLICT)");
  }

  // --- self-duel ---
  try {
    await asChallenger.duel.create({
      username: CHALLENGER_USERNAME, format: "TIMED", preset: "QUICK", ratingMin: 800, ratingMax: 1200,
    });
    assert(false, "self-duel rejected");
  } catch {
    assert(true, "self-duel rejected");
  }

  // --- challenger cannot accept own invite ---
  try {
    await asChallenger.duel.respond({ duelId: duel.id, accept: true });
    assert(false, "challenger cannot respond to own invite");
  } catch {
    assert(true, "challenger cannot respond to own invite");
  }

  // --- accept (3 live CF calls: problemset + both solve histories) ---
  const t0 = Date.now();
  const active = await asOpponent.duel.respond({ duelId: duel.id, accept: true });
  console.log(`     accept took ${Date.now() - t0}ms`);
  assert(active.status === "ACTIVE", "accept → ACTIVE");
  assert(active.challengerHandle === "Kakarotto007" && active.opponentHandle === "bhashkarkumar2063", "handles frozen", {
    a: active.challengerHandle, b: active.opponentHandle,
  });
  const probs = parseProblems(active.problems);
  assert(probs.length === 3, "3 problems selected");
  assert(probs.every((p) => p.rating >= 800 && p.rating <= 900), "all in band", probs.map((p) => p.rating));
  assert(probs.every((p) => p.url.startsWith("https://codeforces.com/problemset/problem/")), "urls valid");
  console.log("     problems:", probs.map((p) => `${p.key} ${p.name} (${p.rating})`).join(" | "));

  // --- state as each side ---
  const s1 = await asChallenger.duel.state({ duelId: duel.id });
  assert(s1.youAre === "A" && s1.status === "ACTIVE", "state as challenger (A)");
  const s2 = await asOpponent.duel.state({ duelId: duel.id });
  assert(s2.youAre === "B", "state as opponent (B)");

  // --- non-participant gets NOT_FOUND ---
  const stranger = await prisma.user.findFirst({
    where: { username: { notIn: [CHALLENGER_USERNAME, OPPONENT_USERNAME] }, NOT: { username: null } },
    select: { id: true },
  });
  if (stranger) {
    const asStranger = createCaller({ db: prisma, userId: stranger.id, headers: new Headers() });
    try {
      await asStranger.duel.state({ duelId: duel.id });
      assert(false, "stranger blocked from duel.state");
    } catch (e) {
      assert((e as { code?: string }).code === "NOT_FOUND", "stranger blocked from duel.state");
    }
  }

  // --- REAL judging: backdate startedAt to cover a genuine past AC ---
  // Grab a recent real AC of the challenger's handle from CF, splice that
  // problem into the duel, and set the window around the real solve time.
  const res = await fetch("https://codeforces.com/api/user.status?handle=Kakarotto007&from=1&count=30");
  const status = (await res.json()) as {
    result?: { creationTimeSeconds: number; verdict?: string; problem: { contestId?: number; index?: string; name: string; rating?: number } }[];
  };
  const realAc = status.result?.find((s) => s.verdict === "OK" && s.problem.contestId && s.problem.index);
  if (!realAc) {
    assert(false, "found a real recent AC to judge against");
  } else {
    const key = `${realAc.problem.contestId}-${realAc.problem.index}`;
    const solveMs = realAc.creationTimeSeconds * 1000;
    const spliced = [...probs];
    spliced[0] = { ...spliced[0], key, name: realAc.problem.name, rating: realAc.problem.rating ?? 800 };
    await prisma.duel.update({
      where: { id: duel.id },
      data: {
        problems: spliced as unknown as object[],
        startedAt: new Date(solveMs - 5 * 60_000), // window opens 5min before the real AC
        endsAt: new Date(solveMs + 25 * 60_000),
        lastCheckedAt: null,
      },
    });
    const fresh = await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } });
    const judged = await checkDuel(prisma, fresh);
    const judgedProbs = parseProblems(judged.problems);
    assert(judgedProbs[0].solvedByA != null, "real AC detected via CF API", judgedProbs[0]);
    assert(judged.status === "FINISHED" && judged.winnerId === challenger.id && !judged.draw,
      "FIRST_SOLVE finishes with challenger as winner", { status: judged.status, winnerId: judged.winnerId });
    assert(judged.finishedAt?.getTime() === solveMs, "finishedAt = the real solve time");

    // state now reports the final result without further checking
    const final = await asOpponent.duel.state({ duelId: duel.id });
    assert(final.status === "FINISHED" && final.scores.a.solved === 1 && final.scores.b.solved === 0, "final state scores 1–0");
  }

  // --- decline flow (fresh duel) ---
  const duel2 = await asChallenger.duel.create({
    username: OPPONENT_USERNAME, format: "TIMED", preset: "STANDARD", ratingMin: 800, ratingMax: 1200,
  });
  createdDuelIds.push(duel2.id);
  const declined = await asOpponent.duel.respond({ duelId: duel2.id, accept: false });
  assert(declined.status === "DECLINED", "decline → DECLINED");

  // --- cancel flow ---
  const duel3 = await asChallenger.duel.create({
    username: OPPONENT_USERNAME, format: "RACE", preset: "QUICK", ratingMin: 800, ratingMax: 1200,
  });
  createdDuelIds.push(duel3.id);
  assert(duel3.winTarget === 3, "RACE winTarget = problemCount");
  await asChallenger.duel.cancel({ duelId: duel3.id });
  const gone = await prisma.duel.findUnique({ where: { id: duel3.id } });
  assert(gone === null, "cancel deletes pending duel");

  // --- expiry (backdate createdAt on own pending row) ---
  const duel4 = await asChallenger.duel.create({
    username: OPPONENT_USERNAME, format: "TIMED", preset: "QUICK", ratingMin: 800, ratingMax: 1200,
  });
  createdDuelIds.push(duel4.id);
  await prisma.duel.update({
    where: { id: duel4.id },
    data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
  });
  try {
    await asOpponent.duel.respond({ duelId: duel4.id, accept: true });
    assert(false, "expired invite rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "PRECONDITION_FAILED", "expired invite rejected");
  }
  const expired = await prisma.duel.findUnique({ where: { id: duel4.id } });
  assert(expired?.status === "EXPIRED", "invite marked EXPIRED");

  // --- scarcity path: selection throws when the band can't supply N problems.
  // (Every real CF band has plenty of unsolved problems for these handles, so
  // exercise the branch directly with an impossible N.)
  const { selectDuelProblems } = await import("../src/server/duel/select-problems");
  try {
    await selectDuelProblems("Kakarotto007", "bhashkarkumar2063", 3500, 3500, 100000);
    assert(false, "scarce band throws PRECONDITION_FAILED");
  } catch (e) {
    assert(
      (e as { code?: string }).code === "PRECONDITION_FAILED",
      "scarce band throws PRECONDITION_FAILED",
    );
  }
}

main()
  .catch((e) => {
    failures++;
    console.error(e);
  })
  .finally(async () => {
    if (createdDuelIds.length > 0) {
      const del = await prisma.duel.deleteMany({ where: { id: { in: createdDuelIds } } });
      console.log(`\nCleaned up ${del.count} test duel(s).`);
    }
    await prisma.$disconnect();
    if (failures > 0) {
      console.error(`\n${failures} failure(s)`);
      process.exitCode = 1;
    } else {
      console.log("\nAll duel E2E checks passed.");
    }
  });
