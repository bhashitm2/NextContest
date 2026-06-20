"use client";

import { Sparkles } from "lucide-react";

import { api } from "@/trpc/react";

/**
 * AI-written verdict banner. Loads after the deterministic VS card so the AI is
 * never on the critical render path; renders nothing while loading or if no
 * verdict is available. `source: "fallback"` means the templated line (no AI).
 */
export function AiVerdict({ username }: { username: string }) {
  const q = api.compare.verdict.useQuery(
    { username },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
  );

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] border border-cp-line bg-cp-surface px-4 py-3.5 text-[13px] text-cp-dim">
        <Sparkles className="size-4 animate-pulse text-cp-accent" />
        Summoning the verdict…
      </div>
    );
  }

  if (!q.data?.verdict) return null;

  return (
    <div
      className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5"
      style={{ background: "color-mix(in srgb, var(--cp-accent) 7%, var(--cp-surface))" }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-cp-accent">
        <Sparkles className="size-3.5" />
        {q.data.source === "ai" ? "AI verdict" : "Verdict"}
      </div>
      <p className="text-[15px] leading-relaxed text-cp-text">{q.data.verdict}</p>
    </div>
  );
}
