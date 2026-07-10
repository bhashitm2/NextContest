"use client";

import { Crown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CountdownTimer } from "@/components/contest/countdown-timer";
import { Avatar, type RouterOutputs } from "@/components/friends/friend-row";

/** Everything ScoreHeader/ProblemTable need — publicResult's shape, which
 * `duel.state` is a superset of (so both feeds work, incl. spectators). */
export type DuelDisplay = RouterOutputs["duel"]["publicResult"];

const CHALLENGER_COLOR = "var(--cp-accent)";
const OPPONENT_COLOR = "#f59e0b"; // amber, mirroring vs-view's friend side

/** How close to the end the duel enters "final minutes" mode (matches the
 * server judge's endgame throttle window). */
export const DUEL_URGENT_MS = 3 * 60_000;

function Player({
  player,
  handle,
  color,
  winner,
  align,
}: {
  player: NonNullable<DuelDisplay["opponent"]>;
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

/** HP-style progress bar: fill = share of the duel's problems solved. Glows
 * briefly when the score just changed. */
function HpBar({
  solved,
  total,
  color,
  align,
  flash,
}: {
  solved: number;
  total: number;
  color: string;
  align: "left" | "right";
  flash: boolean;
}) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-cp-bg">
      <div
        className="h-full rounded-full"
        style={{
          width: `${(solved / Math.max(total, 1)) * 100}%`,
          background: color,
          marginLeft: align === "right" ? "auto" : undefined,
          transition: "width 700ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: flash
            ? `0 0 14px ${color === CHALLENGER_COLOR ? "color-mix(in srgb, var(--cp-accent) 80%, transparent)" : color}`
            : undefined,
        }}
      />
    </div>
  );
}

/** Glow the bar for a moment whenever a player's solve count goes up. */
function useScoreFlash(a: number, b: number): { a: boolean; b: boolean } {
  const prev = useRef({ a, b });
  const [flash, setFlash] = useState({ a: false, b: false });

  useEffect(() => {
    const bumpA = a > prev.current.a;
    const bumpB = b > prev.current.b;
    prev.current = { a, b };
    if (!bumpA && !bumpB) return;
    // Deferred like CountdownTimer's first tick — no sync setState in effects.
    const on = setTimeout(() => setFlash({ a: bumpA, b: bumpB }), 0);
    const off = setTimeout(() => setFlash({ a: false, b: false }), 1500);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [a, b]);

  return flash;
}

/** Ticks only while the duel could cross into the final-minutes window. */
function useUrgent(endsAt: Date | string | null, active: boolean): boolean {
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!active || !endsAt) return;
    const end = new Date(endsAt).getTime();
    const check = () => setUrgent(end - Date.now() < DUEL_URGENT_MS && end > Date.now());
    const first = setTimeout(check, 0);
    const id = setInterval(check, 5_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt, active]);

  return urgent;
}

/** Two-player hero for the duel page: avatars, live score, HP bars, clock. */
export function ScoreHeader({ state }: { state: DuelDisplay }) {
  const finished = state.status === "FINISHED";
  const active = state.status === "ACTIVE";
  const winnerA = finished && !state.draw && state.winnerId === state.challengerId;
  const winnerB = finished && !state.draw && state.winnerId === state.opponentId;
  const flash = useScoreFlash(state.scores.a.solved, state.scores.b.solved);
  const urgent = useUrgent(state.endsAt, active);

  if (!state.opponent) return null; // OPEN duels never render the scoreboard

  return (
    <div
      className="rounded-[18px] border bg-cp-surface p-4 transition-colors sm:p-5"
      style={{
        borderColor: urgent ? "var(--cp-live)" : "var(--cp-line)",
        boxShadow: urgent
          ? "0 0 22px color-mix(in srgb, var(--cp-live) 22%, transparent)"
          : undefined,
        animation: urgent ? "livePulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
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

      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <HpBar
          solved={state.scores.a.solved}
          total={state.problemCount}
          color={CHALLENGER_COLOR}
          align="left"
          flash={flash.a}
        />
        <HpBar
          solved={state.scores.b.solved}
          total={state.problemCount}
          color={OPPONENT_COLOR}
          align="right"
          flash={flash.b}
        />
      </div>

      {active && state.endsAt ? (
        <div className="mt-4 flex items-center justify-center border-t border-cp-line pt-3.5">
          <CountdownTimer
            target={new Date(state.endsAt)}
            size="lg"
            urgentUnderMs={DUEL_URGENT_MS}
          />
        </div>
      ) : null}
    </div>
  );
}
