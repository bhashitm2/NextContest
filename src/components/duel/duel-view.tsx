"use client";

import { RotateCcw, Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { Button } from "@/components/ui/button";
import { type DuelFormatKey, type DuelPreset, joinUrlFor } from "@/lib/duel";
import { toDuelCast } from "@/lib/duel-cast";
import { api } from "@/trpc/react";

import { duelMeta } from "./duel-row";
import { DuelStage } from "./duel-stage";
import { CopyJoinLinkButton } from "./join-open-duel";
import { ProblemTable } from "./problem-table";
import { DUEL_URGENT_MS, ScoreHeader } from "./score-header";
import { ShareResultButton } from "./share-result-button";

type DuelState = RouterOutputs["duel"]["state"];
type H2h = RouterOutputs["duel"]["h2h"];

const PRESET_BY_COUNT: Record<number, DuelPreset> = { 3: "QUICK", 5: "STANDARD", 7: "MARATHON" };

const subscribeNoop = () => () => {};

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-10 text-center text-[14px] text-cp-dim">
      {children}
    </div>
  );
}

/** "Head-to-head 3W–1L–2D · on a 2-win streak" between the two players. */
function H2hStrip({ duelId, myId, initial }: { duelId: string; myId: string; initial: H2h }) {
  const h2h = api.duel.h2h.useQuery({ duelId }, { initialData: initial });
  const d = h2h.data;
  if (!d || d.total === 0) return null;

  const streak =
    d.streak && d.streak.count > 1
      ? ` · ${d.streak.userId === myId ? "you're" : "they're"} on a ${d.streak.count}-win streak`
      : "";

  return (
    <p className="text-center font-mono text-[12px] text-cp-dim">
      Head-to-head{" "}
      <span className="font-bold text-cp-text">
        {d.myWins}W–{d.theirWins}L–{d.draws}D
      </span>
      {streak}
    </p>
  );
}

/** The /duels/[id] body — branches on duel status, polls while live. */
export function DuelView({
  duelId,
  initialState,
  initialH2h,
}: {
  duelId: string;
  initialState: DuelState;
  initialH2h: H2h;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const state = api.duel.state.useQuery(
    { duelId },
    {
      initialData: initialState,
      // The app's one polling query: the server judge runs inside this call
      // (throttled to one CF check per 15s across all viewers — 6s in the
      // final minutes, matching the faster poll below).
      refetchInterval: (q) => {
        const d = q.state.data;
        if (d?.status !== "ACTIVE" || !d.endsAt) return false;
        return new Date(d.endsAt).getTime() - Date.now() < DUEL_URGENT_MS ? 6_000 : 15_000;
      },
    },
  );

  const rematch = api.duel.create.useMutation({
    onSuccess: () => {
      router.push("/duels");
    },
  });

  const duel = state.data;
  const other = duel.youAre === "A" ? duel.opponent : duel.challenger;
  const myId = duel.youAre === "A" ? duel.challengerId : duel.opponentId!;

  // Refresh the lifetime record the moment this duel finishes.
  const prevStatus = useRef(duel.status);
  useEffect(() => {
    if (prevStatus.current !== "FINISHED" && duel.status === "FINISHED") {
      utils.duel.h2h.invalidate({ duelId });
    }
    prevStatus.current = duel.status;
  }, [duel.status, duelId, utils]);

  // Open-link URL needs window.origin — read it as an external value so the
  // server render (no window) falls back cleanly.
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => null,
  );
  const joinUrl =
    duel.status === "OPEN" && duel.inviteToken && origin
      ? joinUrlFor(origin, duel.inviteToken)
      : null;

  if (duel.status === "OPEN") {
    return (
      <div className="space-y-3">
        <Notice>
          Your open challenge is live — share the link, first eligible player to accept starts
          the duel · {duelMeta(duel)}
        </Notice>
        {joinUrl ? <CopyJoinLinkButton url={joinUrl} /> : null}
      </div>
    );
  }

  if (duel.status === "PENDING") {
    return (
      <Notice>
        Waiting for{" "}
        <span className="font-semibold text-cp-text">
          {other?.name ?? `@${other?.username}`}
        </span>{" "}
        to accept · {duelMeta(duel)}
      </Notice>
    );
  }
  if (duel.status === "DECLINED" || duel.status === "EXPIRED") {
    return (
      <Notice>
        This challenge {duel.status === "DECLINED" ? "was declined" : "expired"}.{" "}
        <Link href="/duels" className="text-cp-accent hover:underline">
          Back to duels
        </Link>
      </Notice>
    );
  }

  if (duel.status === "ACTIVE") {
    return (
      <div className="space-y-4">
        <ScoreHeader state={duel} />
        <H2hStrip duelId={duelId} myId={myId} initial={initialH2h} />
        <ProblemTable state={duel} />
        <p className="text-center text-[12px] text-cp-faint">
          Solve on Codeforces with your verified handle — accepted submissions are picked up
          automatically (checked every ~15s, faster in the final minutes).
        </p>
      </div>
    );
  }

  // FINISHED — knockout cinematic over the final scoreboard.
  const youWon =
    !duel.draw &&
    duel.winnerId != null &&
    duel.winnerId === (duel.youAre === "A" ? duel.challengerId : duel.opponentId);
  const banner = duel.draw ? "Dead heat — it's a draw." : youWon ? "You win! 🏆" : "You lost this one.";
  const shareText = duel.draw
    ? `We drew ${duel.scores.a.solved}–${duel.scores.b.solved} in a Codeforces duel on NextContest`
    : youWon
      ? `I won my Codeforces duel ${duel.scores.a.solved}–${duel.scores.b.solved} on NextContest ⚔️`
      : `Just fought a Codeforces duel on NextContest — rematch incoming`;

  return (
    <DuelStage cast={toDuelCast({ ...duel, opponent: duel.opponent! })}>
      <p className="text-center text-[15px] font-semibold text-cp-text">{banner}</p>
      <ScoreHeader state={duel} />
      <H2hStrip duelId={duelId} myId={myId} initial={initialH2h} />
      <ProblemTable state={duel} />
      <div className="flex justify-center gap-2 pt-1">
        <ShareResultButton title="Duel result — NextContest" text={shareText} />
        <Button
          variant="outline"
          disabled={rematch.isPending || !other?.username}
          onClick={() =>
            other?.username &&
            rematch.mutate({
              username: other.username,
              format: duel.format as DuelFormatKey,
              preset: PRESET_BY_COUNT[duel.problemCount] ?? "STANDARD",
              ratingMin: duel.ratingMin,
              ratingMax: duel.ratingMax,
            })
          }
        >
          <RotateCcw data-icon="inline-start" />
          {rematch.isPending ? "Sending…" : "Rematch"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/duels")}>
          <Swords data-icon="inline-start" />
          All duels
        </Button>
      </div>
      {rematch.error ? (
        <p className="text-center text-[13px] text-red-400">{rematch.error.message}</p>
      ) : null}
    </DuelStage>
  );
}
