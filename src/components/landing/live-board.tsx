"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CountdownTimer } from "@/components/contest/countdown-timer";
import { LocalDate } from "@/components/local-date";
import type { Contest } from "@/generated/prisma/client";
import { formatDuration } from "@/lib/format";
import { PLATFORM_META, platformColor } from "@/lib/platforms";

export function LiveBoard({ contests }: { contests: Contest[] }) {
  const next = contests[0];
  const queue = contests.slice(1, 4);

  return (
    <div
      className="overflow-hidden rounded-[20px] border border-cp-line-strong"
      style={{
        background: "linear-gradient(165deg, var(--cp-surface2), var(--cp-surface))",
        boxShadow: "var(--cp-shadow)",
      }}
    >
      <div className="flex items-center justify-between border-b border-cp-line px-[18px] py-[15px]">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cp-dim">
          <span
            className="size-[7px] rounded-full"
            style={{ background: "var(--cp-live)", boxShadow: "0 0 8px var(--cp-live)", animation: "livePulse 1.4s ease-in-out infinite" }}
          />
          Live board
        </span>
        <span className="font-mono text-[11px] text-cp-faint">auto-synced</span>
      </div>

      {next ? (
        <div className="relative overflow-hidden border-b border-cp-line px-[18px] pb-[18px] pt-[22px]">
          <div
            aria-hidden
            className="absolute -top-3.5 right-[-6px] font-mono text-[84px] font-bold leading-none"
            style={{ color: platformColor(next.platform), opacity: 0.1 }}
          >
            {PLATFORM_META[next.platform].short}
          </div>
          <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cp-faint">
            Up next
          </div>
          <PlatformPill platform={next.platform} />
          <div className="relative mb-4 mt-2.5 font-display text-lg font-semibold leading-snug">
            {next.title}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-cp-faint">
                Starts in
              </div>
              <CountdownTimer target={next.startTime} size="lg" />
            </div>
            <div className="text-right text-xs leading-relaxed text-cp-dim">
              <LocalDate date={next.startTime} />
              <div className="text-cp-faint">{formatDuration(next.durationSeconds)} long</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-[18px] py-10 text-center text-sm text-cp-dim">
          No upcoming contests right now — check back soon.
        </div>
      )}

      {queue.length ? (
        <div className="p-1.5">
          {queue.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-colors hover:bg-cp-surface"
            >
              <span
                className="size-2.5 flex-none rounded-full"
                style={{
                  background: platformColor(c.platform),
                  boxShadow: `0 0 8px color-mix(in srgb, ${platformColor(c.platform)} 70%, transparent)`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{c.title}</div>
                <div className="text-[11.5px] text-cp-faint">{PLATFORM_META[c.platform].label}</div>
              </div>
              <CountdownTimer target={c.startTime} size="sm" />
            </div>
          ))}
        </div>
      ) : null}

      <Link
        href="/contests"
        className="flex w-full items-center justify-center gap-[7px] border-t border-cp-line py-3.5 text-[13px] font-semibold text-cp-accent transition-colors hover:bg-cp-surface"
      >
        Open full feed
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function PlatformPill({ platform }: { platform: Contest["platform"] }) {
  const color = platformColor(platform);
  return (
    <span
      className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        color,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {PLATFORM_META[platform].label}
    </span>
  );
}
