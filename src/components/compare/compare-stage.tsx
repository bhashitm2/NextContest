"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiVerdict } from "@/components/compare/ai-verdict";
import { WinnerReveal } from "@/components/compare/intro/winner-reveal";
import { VsView } from "@/components/compare/vs-view";
import type { CompareResult } from "@/lib/compare";
import { toBoxingCast } from "@/lib/compare-cast";

import { AUTODISMISS_MS, REVEAL_AT_MS } from "./intro/choreography";

// Code-split: Three.js only loads when the cinematic actually plays.
const BoxingScene = dynamic(() => import("./intro/boxing-scene"), {
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

export function CompareStage({
  result,
  username,
}: {
  result: CompareResult;
  username: string;
}) {
  const cast = toBoxingCast(result);

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

  // Decide once on mount whether to auto-play (client-only; SSR renders stats).
  // Deferred to a macrotask so we don't setState synchronously in the effect.
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
        <AiVerdict username={username} />
        <VsView result={result} />
        {canPlay ? (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={start}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
            >
              ↻ Replay the match
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
