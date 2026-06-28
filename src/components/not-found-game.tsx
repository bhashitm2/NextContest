"use client";

import { Bug, Home, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Phase = "idle" | "playing" | "over";
type BugItem = { id: number; x: number; y: number };

const GAME_SECONDS = 30;
const SPAWN_MS = 720;
const BUG_LIFETIME_MS = 1100;
const BEST_KEY = "nc-404-best";

// Read the stored best score without setState-in-effect: server snapshot is 0 so
// SSR matches, client snapshot reads localStorage.
const noopSubscribe = () => () => {};
function useStoredBest() {
  return useSyncExternalStore(
    noopSubscribe,
    () => Number(localStorage.getItem(BEST_KEY) ?? "0") || 0,
    () => 0,
  );
}

/**
 * Gamified full-page 404. Shown for unmatched routes and any `notFound()` call
 * — including auth-gated pages reached while logged out. Squash bugs to pass the
 * time; the page you wanted simply isn't in the testset.
 */
export function NotFoundGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [sessionBest, setSessionBest] = useState(0);
  const idRef = useRef(0);
  const scoreRef = useRef(0);

  const best = Math.max(useStoredBest(), sessionBest);

  const start = () => {
    idRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setBugs([]);
    setTimeLeft(GAME_SECONDS);
    setPhase("playing");
  };

  const squash = (id: number) => {
    setBugs((b) => b.filter((bug) => bug.id !== id));
    scoreRef.current += 1;
    setScore(scoreRef.current);
  };

  // Game loop: only timers are created here — every setState runs inside a
  // timer callback (not the effect body), so it never cascades on mount.
  useEffect(() => {
    if (phase !== "playing") return;

    const spawn = window.setInterval(() => {
      const id = ++idRef.current;
      setBugs((b) => [...b, { id, x: 6 + Math.random() * 82, y: 10 + Math.random() * 74 }]);
      window.setTimeout(() => setBugs((cur) => cur.filter((bug) => bug.id !== id)), BUG_LIFETIME_MS);
    }, SPAWN_MS);

    const tick = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);

    const end = window.setTimeout(() => {
      const final = scoreRef.current;
      if (final > best) {
        localStorage.setItem(BEST_KEY, String(final));
        setSessionBest(final);
      }
      setBugs([]);
      setPhase("over");
    }, GAME_SECONDS * 1000);

    return () => {
      window.clearInterval(spawn);
      window.clearInterval(tick);
      window.clearTimeout(end);
    };
  }, [phase, best]);

  return (
    <main className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col items-center justify-center overflow-hidden px-4 py-12 text-center">
      {/* faint code-rain backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--cp-accent) 0 1px, transparent 1px 40px)",
          maskImage: "radial-gradient(ellipse at center, black, transparent 72%)",
        }}
      />

      <p className="relative font-mono text-[12px] uppercase tracking-[0.32em] text-cp-faint">
        Error 404 · Runtime Error
      </p>

      <div
        className="nf-float relative mt-3 font-display text-[clamp(4.5rem,18vw,9rem)] font-bold leading-none tracking-[-0.04em]"
        style={{ animation: "float404 4s ease-in-out infinite" }}
      >
        4
        <span style={{ color: "var(--cp-accent)", textShadow: "0 0 50px color-mix(in srgb, var(--cp-accent) 50%, transparent)" }}>
          0
        </span>
        4
      </div>

      <h1 className="relative mt-1 font-display text-[clamp(1.3rem,3.4vw,2rem)] font-bold tracking-[-0.02em]">
        Wrong Answer on test 404
      </h1>
      <p className="relative mt-2 max-w-md text-[14.5px] text-cp-dim">
        This route isn&apos;t in the testset — looks like you wandered off the judge. While
        you&apos;re here, squash some bugs to feel better about it.
      </p>

      {/* Game surface */}
      <div className="relative mt-7 w-full max-w-[560px]">
        <div className="mb-2 flex items-center justify-between font-mono text-[12px] text-cp-dim">
          <span>
            Bugs squashed: <span className="font-bold text-cp-text">{score}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5 text-cp-accent" /> Best {best}
          </span>
          <span>
            {phase === "playing" ? (
              <>
                ⏱ <span className="font-bold text-cp-text">{timeLeft}s</span>
              </>
            ) : (
              <>{GAME_SECONDS}s round</>
            )}
          </span>
        </div>

        <div className="relative h-[clamp(220px,40vh,340px)] overflow-hidden rounded-[16px] border border-cp-line bg-cp-surface">
          {phase === "playing" ? (
            bugs.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => squash(b.id)}
                aria-label="Squash bug"
                className="nf-bug absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-cp-accent-ink"
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  background: "var(--cp-accent)",
                  boxShadow: "0 0 18px color-mix(in srgb, var(--cp-accent) 55%, transparent)",
                  animation: "bugPop 0.12s ease both, bugWiggle 0.5s ease-in-out infinite",
                }}
              >
                <Bug className="size-[22px]" />
              </button>
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              {phase === "over" ? (
                <>
                  <p className="font-display text-xl font-bold">
                    Accepted ✓ — {score} bug{score === 1 ? "" : "s"} squashed
                  </p>
                  <p className="text-[13px] text-cp-dim">
                    {score >= best && score > 0
                      ? "New personal best. Now actually head back."
                      : "Not your best run. The page still doesn't exist, though."}
                  </p>
                </>
              ) : (
                <>
                  <Bug className="size-9 text-cp-accent" />
                  <p className="max-w-xs text-[13.5px] text-cp-dim">
                    Tap the bugs as they appear. You&apos;ve got {GAME_SECONDS} seconds.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={start}
                className="mt-1 inline-flex h-10 items-center gap-2 rounded-[10px] bg-cp-accent px-5 text-sm font-bold text-cp-accent-ink transition-transform hover:-translate-y-0.5"
              >
                {phase === "over" ? "Play again" : "Start squashing"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/contests"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-cp-accent px-4 text-sm font-bold text-cp-accent-ink transition-transform hover:-translate-y-0.5"
        >
          ← Back to Contests
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-4 text-sm font-semibold text-cp-text transition-colors hover:border-cp-accent"
        >
          <Home className="size-4" /> Home
        </Link>
      </div>
    </main>
  );
}
