import { ArrowUpRight, CalendarDays, Clock } from "lucide-react";

import { CardActions, type BookmarkState } from "@/components/contest/card-actions";
import { CountdownTimer } from "@/components/contest/countdown-timer";
import { LocalDate } from "@/components/local-date";
import { PlatformLogo } from "@/components/platform-logo";
import type { Contest } from "@/generated/prisma/client";
import { formatDuration } from "@/lib/format";
import { PLATFORM_META, platformColor } from "@/lib/platforms";

export function ContestCard({
  contest,
  isAuthenticated,
  bookmark,
}: {
  contest: Contest;
  isAuthenticated: boolean;
  bookmark: BookmarkState;
}) {
  const meta = PLATFORM_META[contest.platform];
  const color = platformColor(contest.platform);

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-[16px] border border-cp-line transition-[transform,box-shadow] duration-200 hover:-translate-y-[5px] hover:shadow-[0_20px_45px_-22px_var(--card-color)]"
      style={
        {
          borderLeft: `3px solid ${color}`,
          background: "linear-gradient(165deg, var(--cp-surface2), var(--cp-surface))",
          "--card-color": color,
        } as React.CSSProperties
      }
    >
      {/* giant faint platform logo watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{ opacity: "var(--cp-wm)" }}
      >
        <PlatformLogo platform={contest.platform} size={150} color={color} />
      </div>

      <div className="relative px-[17px] pt-[17px]">
        <div className="mb-[13px] flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: `color-mix(in srgb, ${color} 13%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
              color,
            }}
          >
            <PlatformLogo platform={contest.platform} size={13} color={color} />
            {meta.label}
          </span>
          {contest.difficulty ? (
            <span className="rounded-full border border-cp-line bg-cp-surface2 px-2.5 py-[3px] text-[11px] font-medium text-cp-dim">
              {contest.difficulty}
            </span>
          ) : null}
        </div>

        <a
          href={contest.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1.5 font-display text-base font-semibold leading-snug text-cp-text transition-colors hover:text-cp-accent"
        >
          {contest.title}
          <ArrowUpRight className="mt-0.5 size-3.5 flex-none text-cp-faint" />
        </a>
      </div>

      <div className="relative flex items-center gap-4 px-[17px] pt-3.5 text-[13px] text-cp-dim">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          <LocalDate date={contest.startTime} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {formatDuration(contest.durationSeconds)}
        </span>
      </div>

      <div className="relative mx-[17px] mt-[15px] flex items-center justify-between rounded-[12px] border border-cp-line bg-cp-bg-soft px-[15px] py-[13px]">
        <span className="text-[10.5px] uppercase tracking-[0.13em] text-cp-faint">Starts in</span>
        <CountdownTimer target={contest.startTime} />
      </div>

      <CardActions contest={contest} isAuthenticated={isAuthenticated} bookmark={bookmark} />
    </div>
  );
}
