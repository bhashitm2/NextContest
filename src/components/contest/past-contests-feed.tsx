"use client";

import { CalendarX2 } from "lucide-react";
import { useState } from "react";

import { FilterPill } from "@/components/contest/filter-pill";
import { PastContestCard } from "@/components/contest/past-contest-card";
import { PlatformLogo } from "@/components/platform-logo";
import type { Contest, Platform } from "@/generated/prisma/client";
import { ACTIVE_PLATFORMS, PLATFORM_META, platformColor } from "@/lib/platforms";

const GRID = "grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3";

export function PastContestsFeed({ contests }: { contests: Contest[] }) {
  const [selected, setSelected] = useState<Platform[]>([]);
  const toggle = (p: Platform) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const counts = Object.fromEntries(
    ACTIVE_PLATFORMS.map((p) => [p, contests.filter((c) => c.platform === p).length]),
  ) as Record<Platform, number>;

  const shown = selected.length
    ? contests.filter((c) => selected.includes(c.platform))
    : contests;

  const resultText = selected.length
    ? `${shown.length} of ${contests.length} contests · filtered by ${selected.length} platform${selected.length > 1 ? "s" : ""}`
    : `Showing the last ${contests.length} finished contests`;

  return (
    <div className="flex flex-col gap-4">
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
            icon={<PlatformLogo platform={p} size={14} color={platformColor(p)} />}
          />
        ))}
      </div>

      <div className="font-mono text-xs text-cp-faint">{resultText}</div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cp-line-strong py-20 text-center text-cp-dim">
          <CalendarX2 className="size-8" />
          <p className="font-medium text-cp-text">No finished contests match those filters</p>
          {selected.length ? (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-[9px] border border-cp-line-strong bg-cp-surface px-4 py-2 text-[13px] font-semibold text-cp-text"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className={GRID}>
          {shown.map((contest) => (
            <PastContestCard key={contest.id} contest={contest} />
          ))}
        </div>
      )}
    </div>
  );
}
