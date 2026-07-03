"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { AUTODISMISS_MS, REVEAL_AT_MS } from "@/components/compare/intro/choreography";
import { WinnerReveal } from "@/components/compare/intro/winner-reveal";
import type { BoxingCast } from "@/lib/compare-cast";

// Code-split like CompareStage: Three.js only loads when the cinematic plays.
const BoxingScene = dynamic(() => import("@/components/compare/intro/boxing-scene"), {
  ssr: false,
  loading: () => null,
});

/** Can the 3D intro play? (no reduced-motion preference, WebGL available) */
function detectCanPlay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The duel-result cinematic: CompareStage's choreography with the cast passed
 * in directly and the page content rendered as children under it. */
export function DuelStage({ cast, children }: { cast: BoxingCast; children: React.ReactNode }) {
  const [canPlay, setCanPlay] = useState(false);
  const [mode, setMode] = useState<"playing" | "done">("done");
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [runId, setRunId] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const end = useCallback(() => {
    clearTimers();
    setExiting(true);
    timers.current.push(setTimeout(() => setMode("done"), 550));
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setRevealed(false);
    setExiting(false);
    setRunId((n) => n + 1);
    setMode("playing");
    timers.current.push(setTimeout(() => setRevealed(true), REVEAL_AT_MS));
    timers.current.push(setTimeout(() => end(), AUTODISMISS_MS));
  }, [end]);

  useEffect(() => {
    const id = setTimeout(() => {
      const ok = detectCanPlay();
      setCanPlay(ok);
      if (ok) start();
    }, 0);
    return () => {
      clearTimeout(id);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="space-y-5">
        {children}
        {canPlay ? (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={start}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
            >
              ↻ Replay the knockout
            </button>
          </div>
        ) : null}
      </div>

      {mode === "playing" ? (
        <div
          className="fixed inset-0 z-[60] transition-opacity duration-500"
          style={{ background: "var(--cp-bg)", opacity: exiting ? 0 : 1 }}
          aria-hidden
        >
          <BoxingScene key={runId} cast={cast} />
          {revealed ? <WinnerReveal cast={cast} onDone={end} /> : null}

          <button
            type="button"
            onClick={end}
            className="absolute right-4 top-4 z-20 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface/70 px-3.5 text-[13px] font-semibold text-cp-text backdrop-blur transition-colors hover:border-cp-accent"
          >
            Skip ⏭
          </button>
        </div>
      ) : null}
    </>
  );
}
