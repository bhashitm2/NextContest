"use client";

import { Loader2, Minus, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { LocalDate } from "@/components/local-date";
import { PlatformLogo } from "@/components/platform-logo";
import type { RatingHistoryEntry } from "@/server/predictions/history";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import { api } from "@/trpc/react";

type P = "CODEFORCES" | "LEETCODE";
const PLATFORMS: P[] = ["CODEFORCES", "LEETCODE"];

const GAIN = "#22c55e";
const LOSS = "#f43f5e";
const deltaColor = (d: number) => (d > 0 ? GAIN : d < 0 ? LOSS : "var(--cp-dim)");

function HistoryRow({ entry, platform }: { entry: RatingHistoryEntry; platform: P }) {
  const live = entry.state === "live";
  const d = entry.delta ?? 0;
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  const color = platformColor(platform);

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] border bg-cp-surface px-4 py-3"
      style={live ? { borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, borderLeftWidth: 3 } : { borderColor: "var(--cp-line)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-cp-text">{entry.contestTitle}</span>
          {live ? (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            >
              Predicted · live
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] text-cp-faint">
          <LocalDate date={entry.date} />
          {entry.rank != null ? ` · rank #${entry.rank}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="inline-flex items-center gap-1 font-display text-[19px] font-bold leading-none" style={{ color: deltaColor(d) }}>
          <Icon className="size-4" />
          {d > 0 ? "+" : ""}
          {d}
        </div>
        {entry.ratingBefore != null && entry.ratingAfter != null ? (
          <div className="mt-1 font-mono text-[11px] text-cp-dim">
            {entry.ratingBefore} → {entry.ratingAfter}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PredictLookup() {
  const [platform, setPlatform] = useState<P>("CODEFORCES");
  const [handle, setHandle] = useState("");
  const [submitted, setSubmitted] = useState<{ platform: P; handle: string } | null>(null);

  const history = api.rating.history.useQuery(submitted ?? { platform, handle: "_" }, {
    enabled: !!submitted,
    retry: false,
  });

  const canSubmit = handle.trim().length > 0;

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setSubmitted({ platform, handle: handle.trim() });
        }}
        className="space-y-3.5 rounded-[14px] border border-cp-line bg-cp-surface p-5"
      >
        <div className="flex gap-2">
          {PLATFORMS.map((p) => {
            const active = p === platform;
            const color = platformColor(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPlatform(p);
                  setSubmitted(null);
                }}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border text-[13px] font-semibold transition-colors"
                style={
                  active
                    ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${color} 38%, transparent)`, color }
                    : { borderColor: "var(--cp-line)", color: "var(--cp-dim)" }
                }
              >
                <PlatformLogo platform={p} size={15} color={active ? color : "var(--cp-dim)"} />
                {PLATFORM_META[p].label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setSubmitted(null);
            }}
            placeholder={platform === "CODEFORCES" ? "Search a handle — e.g. tourist" : "Search a handle — e.g. lee215"}
            className="h-11 w-full rounded-[10px] border border-cp-line bg-cp-bg px-3.5 text-sm text-cp-text outline-none focus:border-cp-accent"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-cp-accent px-5 text-sm font-semibold text-cp-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Search className="size-4" /> Search
          </button>
        </div>
      </form>

      {submitted && history.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-sm text-cp-dim">
          <Loader2 className="size-4 animate-spin" /> Loading {submitted.handle}&apos;s rating history…
        </div>
      ) : null}

      {submitted && history.isError ? (
        <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-7 text-center text-[13.5px] text-cp-dim">
          Something went wrong. Please try again.
        </div>
      ) : null}

      {submitted && history.data ? (
        history.data.status === "not-found" ? (
          <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-7 text-center text-[13.5px] text-cp-dim">
            No {PLATFORM_META[submitted.platform].label} user{" "}
            <span className="font-mono text-cp-text">{submitted.handle}</span>.
          </div>
        ) : history.data.status === "unavailable" ? (
          <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-7 text-center text-[13.5px] text-cp-dim">
            Couldn&apos;t load that right now — please try again in a bit.
          </div>
        ) : history.data.entries.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-7 text-center text-[13.5px] text-cp-dim">
            <span className="font-mono text-cp-text">{submitted.handle}</span> hasn&apos;t competed in any rated contest yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
              <PlatformLogo platform={submitted.platform} size={13} color={platformColor(submitted.platform)} />
              {submitted.handle} · recent contests
            </div>
            {history.data.entries.map((e) => (
              <HistoryRow key={`${e.externalId}-${e.state}`} entry={e} platform={submitted.platform} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
