"use client";

import { CalendarX2 } from "lucide-react";
import { useState } from "react";

import { CalendarSubscribe } from "@/components/contest/calendar-subscribe";
import { ContestCard } from "@/components/contest/contest-card";
import { FilterPill } from "@/components/contest/filter-pill";
import { FollowBar } from "@/components/contest/follow-bar";
import { StaleDataBanner } from "@/components/contest/stale-data-banner";
import type { RouterOutputs } from "@/components/friends/friend-row";
import { PlatformLogo } from "@/components/platform-logo";
import type { Platform } from "@/generated/prisma/client";
import { CONTEST_PLATFORMS, PLATFORM_META, platformColor } from "@/lib/platforms";
import { api } from "@/trpc/react";

// Platform filter pills are shared with the past-contests feed (see filter-pill.tsx).
const GRID = "grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3";

export function ContestFeed({
  isAuthenticated,
  initialContests,
}: {
  isAuthenticated: boolean;
  /** Server-prefetched feed. Seeds the query so the contest list is present in
   * the SSR HTML — crawlers (and slow connections) used to get only a skeleton. */
  initialContests: RouterOutputs["contest"]["getAll"];
}) {
  const [selected, setSelected] = useState<Platform[]>([]);
  const toggle = (p: Platform) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  // Input must match the server-side call in contests/(browse)/page.tsx exactly,
  // or the query key won't line up and initialData is ignored.
  const query = api.contest.getAll.useQuery(
    { status: "UPCOMING", limit: 100 },
    { initialData: initialContests },
  );
  const bookmarksQuery = api.bookmark.getForUser.useQuery(undefined, { enabled: isAuthenticated });

  const bookmarkMap = new Map(
    (bookmarksQuery.data ?? []).map((b) => [
      b.contestId,
      { notify24h: b.notify24h, notify1h: b.notify1h },
    ]),
  );

  const all = query.data.items;
  const counts = Object.fromEntries(
    CONTEST_PLATFORMS.map((p) => [p, all.filter((c) => c.platform === p).length]),
  ) as Record<Platform, number>;

  const shown = selected.length ? all.filter((c) => selected.includes(c.platform)) : all;

  const resultText = selected.length
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
        {CONTEST_PLATFORMS.map((p) => (
          <FilterPill
            key={p}
            label={PLATFORM_META[p].label}
            color={platformColor(p)}
            count={counts[p]}
            active={selected.includes(p)}
            onClick={() => toggle(p)}
            icon={<PlatformLogo platform={p} size={14} color={platformColor(p)} />}
          />
        ))}
      </div>

      <div className="font-mono text-xs text-cp-faint">{resultText}</div>

      <StaleDataBanner />

      {shown.length === 0 ? (
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
