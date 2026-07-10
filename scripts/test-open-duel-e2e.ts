/**
 * Server-side E2E for OPEN duels (shareable invite links) against the shared
 * DB + live CF API. Exercises the real tRPC procedures via createCaller for
 * the two test accounts, then cleans up every duel it created.
 *
 *   npx tsx scripts/test-open-duel-e2e.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { parseProblems } from "../src/server/duel/judge";
import { createCaller } from "../src/server/routers/_app";

const CHALLENGER_USERNAME = "bit_1403"; // CF Kakarotto007
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
  console.log(`Using ${CHALLENGER_USERNAME} (challenger) / ${OPPONENT_USERNAME} (acceptor)`);

  const asChallenger = createCaller({ db: prisma, userId: challenger.id, headers: new Headers() });
  const asOpponent = createCaller({ db: prisma, userId: opponent.id, headers: new Headers() });
  const asAnon = createCaller({ db: prisma, userId: null, headers: new Headers() });

  // --- createOpen (happy path) ---
  const { duel, joinUrl } = await asChallenger.duel.createOpen({
    format: "TIMED",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 900,
  });
  createdDuelIds.push(duel.id);
  assert(
    duel.status === "OPEN" && duel.opponentId === null && !!duel.inviteToken,
    "createOpen → OPEN, no opponent, has token",
    { status: duel.status, opponentId: duel.opponentId },
  );
  assert(duel.winTarget === null && duel.problemCount === 3, "TIMED quick config derived");
  assert(joinUrl.endsWith(`/duels/join/${duel.inviteToken}`), "joinUrl shape", joinUrl);
  const token = duel.inviteToken!;

  // --- pendingCount ignores OPEN rows (counts only true PENDING invites) ---
  const oppPending = await asOpponent.duel.pendingCount();
  const truePending = await prisma.duel.count({
    where: {
      opponentId: opponent.id,
      status: "PENDING",
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  assert(oppPending === truePending, "opponent pendingCount unaffected by OPEN rows", {
    oppPending,
    truePending,
  });

  // --- list shows it under `open` with a joinUrl ---
  const myList = await asChallenger.duel.list();
  const openRow = myList.open.find((d) => d.id === duel.id);
  assert(!!openRow && openRow.joinUrl.includes(token), "list.open has the link");
  const oppList = await asOpponent.duel.list();
  assert(
    !oppList.open.some((d) => d.id === duel.id) &&
      !oppList.incoming.some((d) => d.id === duel.id),
    "open duel invisible in opponent's list",
  );

  // --- joinInfo: anonymous visitor ---
  const anonInfo = await asAnon.duel.joinInfo({ token });
  assert(anonInfo.kind === "open", "joinInfo anon → open");
  if (anonInfo.kind === "open") {
    assert(
      anonInfo.challenger.username === CHALLENGER_USERNAME &&
        anonInfo.challengerCf?.handle === "Kakarotto007",
      "joinInfo exposes challenger profile + CF handle",
    );
    assert(
      !anonInfo.viewer.signedIn && !anonInfo.viewer.hasVerifiedHandle,
      "anon viewer flags false",
    );
    assert(
      !("inviteToken" in anonInfo) && !("joinUrl" in anonInfo) && !("id" in anonInfo),
      "joinInfo leaks no token/id",
    );
  }

  // --- joinInfo: challenger sees own link ---
  const ownInfo = await asChallenger.duel.joinInfo({ token });
  assert(
    ownInfo.kind === "own" && (ownInfo.kind !== "own" || ownInfo.joinUrl.includes(token)),
    "joinInfo challenger → own + link",
  );

  // --- joinInfo: eligible signed-in viewer ---
  const oppInfo = await asOpponent.duel.joinInfo({ token });
  assert(oppInfo.kind === "open", "joinInfo opponent → open");
  if (oppInfo.kind === "open") {
    assert(
      oppInfo.viewer.signedIn &&
        oppInfo.viewer.hasVerifiedHandle &&
        oppInfo.viewer.pairConflictDuelId === null,
      "opponent viewer eligible",
      oppInfo.viewer,
    );
  }

  // --- joinInfo: bogus token ---
  const bogus = await asAnon.duel.joinInfo({ token: "0000000000-not-a-token" });
  assert(bogus.kind === "invalid", "joinInfo bogus token → invalid");

  // --- challenger cannot accept own link ---
  try {
    await asChallenger.duel.acceptOpen({ token });
    assert(false, "self-accept rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "BAD_REQUEST", "self-accept rejected (BAD_REQUEST)");
  }

  // --- pair conflict blocks accepting ---
  const friendDuel = await asChallenger.duel.create({
    username: OPPONENT_USERNAME,
    format: "TIMED",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 1200,
  });
  createdDuelIds.push(friendDuel.id);
  try {
    await asOpponent.duel.acceptOpen({ token });
    assert(false, "pair conflict rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "CONFLICT", "pair conflict rejected (CONFLICT)");
  }
  const conflictInfo = await asOpponent.duel.joinInfo({ token });
  assert(
    conflictInfo.kind === "open" &&
      (conflictInfo.kind !== "open" || conflictInfo.viewer.pairConflictDuelId === friendDuel.id),
    "joinInfo surfaces the conflicting duel id",
  );
  await asChallenger.duel.cancel({ duelId: friendDuel.id });

  // --- accept (3 live CF calls) ---
  const t0 = Date.now();
  const active = await asOpponent.duel.acceptOpen({ token });
  console.log(`     accept took ${Date.now() - t0}ms`);
  assert(active.status === "ACTIVE" && active.opponentId === opponent.id, "acceptOpen → ACTIVE, claimer bound");
  assert(
    active.challengerHandle === "Kakarotto007" && active.opponentHandle === "bhashkarkumar2063",
    "handles frozen at claim",
    { a: active.challengerHandle, b: active.opponentHandle },
  );
  const probs = parseProblems(active.problems);
  assert(probs.length === 3, "3 problems selected");
  assert(probs.every((p) => p.rating >= 800 && p.rating <= 900), "all in band");
  assert(!!active.startedAt && !!active.endsAt && !!active.respondedAt, "clock started");

  // --- joinInfo after claim ---
  const claimedAnon = await asAnon.duel.joinInfo({ token });
  assert(
    claimedAnon.kind === "claimed" && (claimedAnon.kind !== "claimed" || claimedAnon.duelId === undefined),
    "joinInfo after claim: anon gets no duelId",
  );
  const claimedOpp = await asOpponent.duel.joinInfo({ token });
  assert(
    claimedOpp.kind === "claimed" && (claimedOpp.kind !== "claimed" || claimedOpp.duelId === duel.id),
    "joinInfo after claim: participant gets duelId",
  );

  // --- accept again → CONFLICT ---
  try {
    await asOpponent.duel.acceptOpen({ token });
    assert(false, "second accept rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "CONFLICT", "second accept rejected (CONFLICT)");
  }

  // --- publicResult: ACTIVE duel is NOT public ---
  try {
    await asAnon.duel.publicResult({ duelId: duel.id });
    assert(false, "publicResult hides ACTIVE duels");
  } catch (e) {
    assert((e as { code?: string }).code === "NOT_FOUND", "publicResult hides ACTIVE duels");
  }

  // Clean up the ACTIVE duel now so the race test below has no pair conflict.
  await prisma.duel.delete({ where: { id: duel.id } });
  createdDuelIds.splice(createdDuelIds.indexOf(duel.id), 1);

  // --- DOUBLE-CLAIM RACE: two concurrent accepts, exactly one wins ---
  const race = await asChallenger.duel.createOpen({
    format: "FIRST_SOLVE",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 900,
  });
  createdDuelIds.push(race.duel.id);
  const raceToken = race.duel.inviteToken!;
  const results = await Promise.allSettled([
    asOpponent.duel.acceptOpen({ token: raceToken }),
    asOpponent.duel.acceptOpen({ token: raceToken }),
  ]);
  const wins = results.filter((r) => r.status === "fulfilled");
  const losses = results.filter(
    (r) => r.status === "rejected" && (r.reason as { code?: string }).code === "CONFLICT",
  );
  assert(wins.length === 1 && losses.length === 1, "race: exactly one accept wins", results.map((r) => r.status === "rejected" ? String(r.reason) : "fulfilled"));
  const raced = await prisma.duel.findUniqueOrThrow({ where: { id: race.duel.id } });
  assert(
    raced.status === "ACTIVE" && raced.opponentId === opponent.id,
    "race: DB has exactly one opponent",
  );
  await prisma.duel.delete({ where: { id: race.duel.id } });
  createdDuelIds.splice(createdDuelIds.indexOf(race.duel.id), 1);

  // --- expiry: backdated link can't be accepted, flips EXPIRED ---
  const stale = await asChallenger.duel.createOpen({
    format: "TIMED",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 900,
  });
  createdDuelIds.push(stale.duel.id);
  await prisma.duel.update({
    where: { id: stale.duel.id },
    data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
  });
  try {
    await asOpponent.duel.acceptOpen({ token: stale.duel.inviteToken! });
    assert(false, "expired link rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "PRECONDITION_FAILED", "expired link rejected");
  }
  const staleInfo = await asAnon.duel.joinInfo({ token: stale.duel.inviteToken! });
  assert(staleInfo.kind === "expired", "joinInfo → expired");
  const staleRow = await prisma.duel.findUnique({ where: { id: stale.duel.id } });
  assert(staleRow?.status === "EXPIRED", "row marked EXPIRED");

  // --- cancel deletes an OPEN link; its joinInfo goes invalid ---
  const cancelMe = await asChallenger.duel.createOpen({
    format: "RACE",
    preset: "QUICK",
    ratingMin: 800,
    ratingMax: 900,
  });
  createdDuelIds.push(cancelMe.duel.id);
  await asChallenger.duel.cancel({ duelId: cancelMe.duel.id });
  const goneRow = await prisma.duel.findUnique({ where: { id: cancelMe.duel.id } });
  assert(goneRow === null, "cancel deletes OPEN row");
  const goneInfo = await asAnon.duel.joinInfo({ token: cancelMe.duel.inviteToken! });
  assert(goneInfo.kind === "invalid", "cancelled link → invalid");
  createdDuelIds.splice(createdDuelIds.indexOf(cancelMe.duel.id), 1);

  // --- live-link cap: 5 unclaimed links max ---
  const seeded: string[] = [];
  for (let i = 0; i < 5; i++) {
    const row = await prisma.duel.create({
      data: {
        challengerId: challenger.id,
        opponentId: null,
        status: "OPEN",
        inviteToken: `test-cap-${Date.now()}-${i}`,
        format: "TIMED",
        problemCount: 3,
        durationSec: 1800,
        ratingMin: 800,
        ratingMax: 900,
      },
    });
    seeded.push(row.id);
  }
  createdDuelIds.push(...seeded);
  try {
    await asChallenger.duel.createOpen({
      format: "TIMED",
      preset: "QUICK",
      ratingMin: 800,
      ratingMax: 900,
    });
    assert(false, "6th live link rejected");
  } catch (e) {
    assert((e as { code?: string }).code === "CONFLICT", "6th live link rejected (CONFLICT)");
  }

  // --- h2h counts + streak (synthetic FINISHED pair duels) ---
  const baseline = await prisma.duel.findMany({
    where: {
      status: "FINISHED",
      OR: [
        { challengerId: challenger.id, opponentId: opponent.id },
        { challengerId: opponent.id, opponentId: challenger.id },
      ],
    },
    select: { winnerId: true, draw: true },
  });
  const baseWins = baseline.filter((d) => d.winnerId === challenger.id).length;
  const baseLosses = baseline.filter((d) => d.winnerId === opponent.id).length;
  const baseDraws = baseline.filter((d) => !d.winnerId).length;

  const mkFinished = async (winnerId: string | null, minutesAgo: number) => {
    const end = new Date(Date.now() - minutesAgo * 60_000);
    const row = await prisma.duel.create({
      data: {
        challengerId: challenger.id,
        opponentId: opponent.id,
        status: "FINISHED",
        format: "TIMED",
        problemCount: 3,
        durationSec: 1800,
        ratingMin: 800,
        ratingMax: 900,
        challengerHandle: "Kakarotto007",
        opponentHandle: "bhashkarkumar2063",
        problems: [],
        startedAt: new Date(end.getTime() - 30 * 60_000),
        endsAt: end,
        finishedAt: end,
        winnerId,
        draw: winnerId === null,
      },
    });
    createdDuelIds.push(row.id);
    return row;
  };
  const f1 = await mkFinished(null, 30); // draw (oldest)
  await mkFinished(challenger.id, 20);
  await mkFinished(challenger.id, 10); // newest → 2-win challenger streak

  const h2h = await asChallenger.duel.h2h({ duelId: f1.id });
  assert(!!h2h, "h2h returns for participant");
  if (h2h) {
    assert(
      h2h.myWins === baseWins + 2 && h2h.theirWins === baseLosses && h2h.draws === baseDraws + 1,
      "h2h counts",
      { h2h, baseWins, baseLosses, baseDraws },
    );
    assert(
      h2h.streak?.userId === challenger.id && h2h.streak.count === 2,
      "h2h streak: challenger W2",
      h2h.streak,
    );
  }
  const oppH2h = await asOpponent.duel.h2h({ duelId: f1.id });
  assert(
    !!oppH2h && oppH2h.myWins === baseLosses && oppH2h.theirWins === baseWins + 2,
    "h2h mirrored for the other side",
  );

  // --- h2h: non-participant blocked ---
  const stranger = await prisma.user.findFirst({
    where: { username: { notIn: [CHALLENGER_USERNAME, OPPONENT_USERNAME] }, NOT: { username: null } },
    select: { id: true },
  });
  if (stranger) {
    const asStranger = createCaller({ db: prisma, userId: stranger.id, headers: new Headers() });
    try {
      await asStranger.duel.h2h({ duelId: f1.id });
      assert(false, "stranger blocked from h2h");
    } catch (e) {
      assert((e as { code?: string }).code === "NOT_FOUND", "stranger blocked from h2h");
    }
  }

  // --- publicResult: FINISHED duel is public, token-free ---
  const pub = await asAnon.duel.publicResult({ duelId: f1.id });
  assert(pub.status === "FINISHED" && pub.draw, "publicResult anon → finished summary");
  assert(!("inviteToken" in pub), "publicResult strips inviteToken");
  assert(
    pub.challenger.username === CHALLENGER_USERNAME &&
      pub.opponent?.username === OPPONENT_USERNAME,
    "publicResult includes both profiles",
  );
}

main()
  .catch((e) => {
    failures++;
    console.error("UNCAUGHT", e);
  })
  .finally(async () => {
    if (createdDuelIds.length > 0) {
      await prisma.duel.deleteMany({ where: { id: { in: createdDuelIds } } });
      console.log(`cleaned up ${createdDuelIds.length} duel rows`);
    }
    await prisma.$disconnect();
    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURES`);
    process.exitCode = failures === 0 ? 0 : 1;
  });
