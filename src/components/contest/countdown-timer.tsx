"use client";

import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Live countdown to `target`, with the design's three states:
 * normal, urgent (< 1h, red blink), and started ("LIVE NOW").
 * Renders a neutral placeholder until mounted to avoid hydration mismatch.
 */
export function CountdownTimer({
  target,
  size = "md",
}: {
  target: Date;
  size?: "sm" | "md" | "lg";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const sizeClass = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[13px]" : "text-[18px]";

  if (now === null) {
    return (
      <span className={cn("font-mono font-bold tabular-nums text-cp-dim", sizeClass)}>··:··:··</span>
    );
  }

  const remaining = target.getTime() - now;

  if (remaining <= 0) {
    return (
      <span
        className="inline-flex items-center gap-[7px] font-mono text-[16px] font-bold"
        style={{ color: "var(--cp-live)" }}
      >
        <span
          className="size-[7px] rounded-full"
          style={{ background: "var(--cp-live)", animation: "livePulse 1.2s ease-in-out infinite" }}
        />
        LIVE NOW
      </span>
    );
  }

  const urgent = remaining < 60 * 60 * 1000;

  if (urgent) {
    return (
      <span
        className={cn("font-mono font-bold tracking-tight tabular-nums", sizeClass)}
        style={{
          color: "var(--cp-live)",
          animation: "blink 1.4s ease-in-out infinite",
          textShadow: "0 0 18px color-mix(in srgb, var(--cp-live) 40%, transparent)",
        }}
      >
        {formatCountdown(remaining)}
      </span>
    );
  }

  return (
    <span
      className={cn("font-mono font-bold tracking-tight tabular-nums", sizeClass)}
      style={
        size === "lg"
          ? {
              color: "var(--cp-accent)",
              textShadow: "0 0 26px color-mix(in srgb, var(--cp-accent) 35%, transparent)",
            }
          : size === "sm"
            ? { color: "var(--cp-text-dim)" }
            : { color: "var(--cp-text)" }
      }
    >
      {formatCountdown(remaining)}
    </span>
  );
}
