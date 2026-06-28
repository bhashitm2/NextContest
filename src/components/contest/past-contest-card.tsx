import { ArrowUpRight, CalendarCheck, LineChart, Swords } from "lucide-react";
import Link from "next/link";

import { LocalDate } from "@/components/local-date";
import { PlatformLogo } from "@/components/platform-logo";
import type { Contest } from "@/generated/prisma/client";
import { PLATFORM_META, platformColor } from "@/lib/platforms";

/** Platforms with a rating predictor (see server/predictions). */
const PREDICTABLE: Contest["platform"][] = ["CODEFORCES", "LEETCODE"];

/** A finished-contest card: like ContestCard but with an "Ended" timestamp and a
 * "Compare with friend" CTA (the target page handles the sign-in / friend gate). */
export function PastContestCard({ contest }: { contest: Contest }) {
  const meta = PLATFORM_META[contest.platform];
  const color = platformColor(contest.platform);

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-[16px] border border-cp-line"
      style={
        {
          borderLeft: `3px solid ${color}`,
          background: "linear-gradient(165deg, var(--cp-surface2), var(--cp-surface))",
          "--card-color": color,
        } as React.CSSProperties
      }
    >
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

        {contest.platform === "LEETCODE" ? (
          // LeetCode → in-app results page (questions + ranking); the platform
          // link demotes to a small external icon.
          <div className="flex items-start gap-1.5">
            <Link
              href={`/contests/${contest.id}`}
              className="font-display text-base font-semibold leading-snug text-cp-text transition-colors hover:text-cp-accent"
            >
              {contest.title}
            </Link>
            <a
              href={contest.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on LeetCode"
              className="mt-0.5 shrink-0"
            >
              <ArrowUpRight className="size-3.5 text-cp-faint transition-colors hover:text-cp-accent" />
            </a>
          </div>
        ) : (
          <a
            href={contest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 font-display text-base font-semibold leading-snug text-cp-text transition-colors hover:text-cp-accent"
          >
            {contest.title}
            <ArrowUpRight className="mt-0.5 size-3.5 flex-none text-cp-faint" />
          </a>
        )}
      </div>

      <div className="relative flex items-center gap-1.5 px-[17px] pt-3.5 text-[13px] text-cp-dim">
        <CalendarCheck className="size-3.5" />
        Ended <LocalDate date={contest.endTime} />
      </div>

      <div className="relative mt-auto flex flex-col gap-2 p-[17px] pt-[15px]">
        <Link
          href={`/contests/${contest.id}/compare`}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-cp-accent px-3.5 text-[13px] font-semibold text-cp-accent-ink transition-opacity hover:opacity-90"
        >
          <Swords className="size-3.5" />
          Compare with friend
        </Link>
        {PREDICTABLE.includes(contest.platform) ? (
          <Link
            href={`/contests/${contest.id}/predict`}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
          >
            <LineChart className="size-3.5" />
            Predict my rating
          </Link>
        ) : null}
      </div>
    </div>
  );
}
