"use client";

import { RotateCcw, Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { Button } from "@/components/ui/button";
import { type DuelFormatKey, type DuelPreset } from "@/lib/duel";
import { toDuelCast } from "@/lib/duel-cast";
import { api } from "@/trpc/react";

import { duelMeta } from "./duel-row";
import { DuelStage } from "./duel-stage";
import { ProblemTable } from "./problem-table";
import { ScoreHeader } from "./score-header";

type DuelState = RouterOutputs["duel"]["state"];

const PRESET_BY_COUNT: Record<number, DuelPreset> = { 3: "QUICK", 5: "STANDARD", 7: "MARATHON" };

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-10 text-center text-[14px] text-cp-dim">
      {children}
    </div>
  );
}

/** The /duels/[id] body — branches on duel status, polls while live. */
export function DuelView({ duelId, initialState }: { duelId: string; initialState: DuelState }) {
  const router = useRouter();
  const state = api.duel.state.useQuery(
    { duelId },
    {
      initialData: initialState,
      // The app's one polling query: the server judge runs inside this call
      // (throttled to one CF check per 15s across all viewers).
      refetchInterval: (q) => (q.state.data?.status === "ACTIVE" ? 15_000 : false),
    },
  );

  const rematch = api.duel.create.useMutation({
    onSuccess: () => {
      router.push("/duels");
    },
  });

  const duel = state.data;
  const other = duel.youAre === "A" ? duel.opponent : duel.challenger;

  if (duel.status === "PENDING") {
    return (
      <Notice>
        Waiting for <span className="font-semibold text-cp-text">{other.name ?? `@${other.username}`}</span> to
        accept · {duelMeta(duel)}
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
        <ProblemTable state={duel} />
        <p className="text-center text-[12px] text-cp-faint">
          Solve on Codeforces with your verified handle — accepted submissions are picked up
          automatically (checked every ~15s).
        </p>
      </div>
    );
  }

  // FINISHED — knockout cinematic over the final scoreboard.
  const youWon = !duel.draw && duel.winnerId != null && duel.winnerId === (duel.youAre === "A" ? duel.challengerId : duel.opponentId);
  const banner = duel.draw ? "Dead heat — it's a draw." : youWon ? "You win! 🏆" : "You lost this one.";

  return (
    <DuelStage cast={toDuelCast(duel)}>
      <p className="text-center text-[15px] font-semibold text-cp-text">{banner}</p>
      <ScoreHeader state={duel} />
      <ProblemTable state={duel} />
      <div className="flex justify-center gap-2 pt-1">
        <Button
          variant="outline"
          disabled={rematch.isPending || !other.username}
          onClick={() =>
            other.username &&
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
