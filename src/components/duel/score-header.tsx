"use client";

import { Crown } from "lucide-react";

import { CountdownTimer } from "@/components/contest/countdown-timer";
import { Avatar, type RouterOutputs } from "@/components/friends/friend-row";

type DuelState = RouterOutputs["duel"]["state"];

const CHALLENGER_COLOR = "var(--cp-accent)";
const OPPONENT_COLOR = "#f59e0b"; // amber, mirroring vs-view's friend side

function Player({
  player,
  handle,
  color,
  winner,
  align,
}: {
  player: DuelState["challenger"];
  handle: string | null;
  color: string;
  winner: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <span className="rounded-full p-[2px]" style={{ background: color }}>
        <Avatar image={player.image} name={player.name} username={player.username} size={52} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-cp-text">
          {align === "right" && winner ? <Crown className="size-4 shrink-0" style={{ color }} /> : null}
          <span className="truncate">{player.name ?? `@${player.username}`}</span>
          {align === "left" && winner ? <Crown className="size-4 shrink-0" style={{ color }} /> : null}
        </div>
        {handle ? (
          <div className="truncate font-mono text-[12px]" style={{ color }}>
            {handle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Two-player hero for the duel page: avatars, live score, clock. */
export function ScoreHeader({ state }: { state: DuelState }) {
  const finished = state.status === "FINISHED";
  const winnerA = finished && !state.draw && state.winnerId === state.challengerId;
  const winnerB = finished && !state.draw && state.winnerId === state.opponentId;

  return (
    <div className="rounded-[18px] border border-cp-line bg-cp-surface p-4 sm:p-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Player
          player={state.challenger}
          handle={state.challengerHandle}
          color={CHALLENGER_COLOR}
          winner={winnerA}
          align="left"
        />
        <div className="text-center">
          <div className="font-display text-[30px] font-bold leading-none tracking-tight text-cp-text">
            {state.scores.a.solved}
            <span className="mx-2 text-cp-faint">–</span>
            {state.scores.b.solved}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-cp-faint">
            {finished ? "Final" : "solved"}
          </div>
        </div>
        <Player
          player={state.opponent}
          handle={state.opponentHandle}
          color={OPPONENT_COLOR}
          winner={winnerB}
          align="right"
        />
      </div>

      {state.status === "ACTIVE" && state.endsAt ? (
        <div className="mt-4 flex items-center justify-center border-t border-cp-line pt-3.5">
          <CountdownTimer target={new Date(state.endsAt)} size="lg" />
        </div>
      ) : null}
    </div>
  );
}
