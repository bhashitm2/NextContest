"use client";

import { CalendarX2 } from "lucide-react";
import { useState } from "react";

import { CalendarSubscribe } from "@/components/contest/calendar-subscribe";
import { ContestCard } from "@/components/contest/contest-card";
import { FollowBar } from "@/components/contest/follow-bar";
import { StaleDataBanner } from "@/components/contest/stale-data-banner";
import type { Platform } from "@/generated/prisma/client";
import { ACTIVE_PLATFORMS, PLATFORM_META, platformColor } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const GRID = "grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3";

export function ContestFeed({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [selected, setSelected] = useState<Platform[]>([]);
  const toggle = (p: Platform) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const query = api.contest.getAll.useQuery({ status: "UPCOMING", limit: 100 });
  const bookmarksQuery = api.bookmark.getForUser.useQuery(undefined, { enabled: isAuthenticated });

  const bookmarkMap = new Map(
    (bookmarksQuery.data ?? []).map((b) => [
      b.contestId,
      { notify24h: b.notify24h, notify1h: b.notify1h },
    ]),
  );

  const all = query.data?.items ?? [];
  const counts = Object.fromEntries(
    ACTIVE_PLATFORMS.map((p) => [p, all.filter((c) => c.platform === p).length]),
  ) as Record<Platform, number>;

  const shown = selected.length ? all.filter((c) => selected.includes(c.platform)) : all;

  const resultText = query.isLoading
    ? "Loading contests…"
    : selected.length
      ? `${shown.length} of ${all.length} contests · filtered by ${selected.length} platform${selected.length > 1 ? "s" : ""}`
      : `Showing all ${all.length} upcoming contests`;

  return (
    <div className="flex flex-col gap-4">
      {isAuthenticated ? (
        <>
          <FollowBar />
          <CalendarSubscribe />
        </>
      ) : null}

      {/* filter pills */}
      <div className="flex flex-wrap items-center gap-[9px]">
        <FilterPill label="All" active={selected.length === 0} onClick={() => setSelected([])} />
        {ACTIVE_PLATFORMS.map((p) => (
          <FilterPill
            key={p}
            label={PLATFORM_META[p].label}
            color={platformColor(p)}
            count={counts[p]}
            active={selected.includes(p)}
            onClick={() => toggle(p)}
          />
        ))}
      </div>

      <div className="font-mono text-xs text-cp-faint">{resultText}</div>

      <StaleDataBanner />

      {query.isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState filtered={selected.length > 0} onClear={() => setSelected([])} />
      ) : (
        <>
          <div className={GRID}>
            {shown.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                isAuthenticated={isAuthenticated}
                bookmark={bookmarkMap.get(contest.id)}
              />
            ))}
          </div>
          <div className="mt-4 text-center font-mono text-xs text-cp-faint">
            — you&apos;re all caught up · {shown.length} upcoming —
          </div>
        </>
      )}
    </div>
  );
}

function FilterPill({
  label,
  color,
  count,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        !active && "border-cp-line text-cp-dim hover:bg-cp-surface",
      )}
      style={
        active
          ? {
              background: `color-mix(in srgb, ${color ?? "var(--cp-accent)"} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${color ?? "var(--cp-accent)"} 38%, transparent)`,
              color: color ?? "var(--cp-accent)",
            }
          : undefined
      }
    >
      {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
      {label}
      {typeof count === "number" ? (
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      ) : null}
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="flex h-[260px] flex-col gap-3 rounded-2xl border border-cp-line bg-cp-surface p-[17px]">
      <div className="h-5 w-24 animate-pulse rounded-full bg-cp-surface2" />
      <div className="h-5 w-3/4 animate-pulse rounded bg-cp-surface2" />
      <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-cp-surface2" />
      <div className="mt-auto h-14 w-full animate-pulse rounded-xl bg-cp-surface2" />
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cp-line-strong py-20 text-center text-cp-dim">
      <CalendarX2 className="size-8" />
      <p className="font-medium text-cp-text">No contests match those filters</p>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-[9px] border border-cp-line-strong bg-cp-surface px-4 py-2 text-[13px] font-semibold text-cp-text"
        >
          Clear filters
        </button>
      ) : (
        <p className="text-sm">Check back soon — new contests are synced regularly.</p>
      )}
    </div>
  );
}
