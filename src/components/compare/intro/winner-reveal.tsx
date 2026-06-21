"use client";

import { useEffect, useState } from "react";

import { avatarSrc } from "@/lib/avatar";
import type { BoxingCast } from "@/lib/compare-cast";
import { castWinner } from "@/lib/compare-cast";

/** Full-screen DOM reveal shown over the canvas once the KO lands. */
export function WinnerReveal({ cast, onDone }: { cast: BoxingCast; onDone: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const winner = castWinner(cast);
  const isTie = winner === null;
  const color = winner?.colorCss ?? "var(--cp-accent)";
  const name = winner?.name ?? "Draw";
  const initial = (winner?.name ?? "—").charAt(0).toUpperCase();

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center transition-all duration-700"
      style={{ opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(14px)" }}
    >
      {/* glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
        style={{ background: color, opacity: 0.22 }}
      />

      {isTie ? (
        <>
          <div className="font-mono text-[13px] uppercase tracking-[0.3em] text-cp-dim">
            Final bell
          </div>
          <div className="mt-3 font-display text-[clamp(2.6rem,9vw,5rem)] font-black leading-none tracking-tight text-cp-text">
            DRAW
          </div>
        </>
      ) : (
        <>
          <div
            className="grid size-[120px] place-items-center rounded-full text-4xl font-bold text-cp-accent-ink"
            style={{ background: color, boxShadow: `0 0 0 4px ${color}, 0 0 60px ${color}` }}
          >
            {avatarSrc(winner!.avatar) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc(winner!.avatar)!}
                alt=""
                className="size-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div
            className="mt-5 font-mono text-[13px] uppercase tracking-[0.3em]"
            style={{ color }}
          >
            Winner
          </div>
          <div className="mt-1 font-display text-[clamp(2.2rem,8vw,4.4rem)] font-black leading-none tracking-tight text-cp-text">
            {name}
          </div>
        </>
      )}

      <div className="mt-4 font-mono text-[15px] font-bold text-cp-dim">
        {cast.aScore} <span className="text-cp-faint">–</span> {cast.bScore}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="pointer-events-auto mt-8 inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface/80 px-4 text-[13px] font-semibold text-cp-text backdrop-blur transition-colors hover:border-cp-accent"
      >
        View full breakdown ↓
      </button>
    </div>
  );
}
