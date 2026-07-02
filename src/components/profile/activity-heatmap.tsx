"use client";

import { useState } from "react";

import type { ActivityDay } from "@/lib/profile";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 53;

/** 4-step intensity for a day's count relative to the busiest day. */
function level(count: number, max: number): number {
  if (count <= 0) return 0;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

const LEVEL_OPACITY = [0, 0.3, 0.55, 0.8, 1];

/** "1 July 2026" for a "YYYY-MM-DD" key. */
function fmtDay(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Hover = { day: string; count: number; x: number; y: number; flip: boolean };

/** GitHub-style submissions heatmap: 53 week-columns × 7 day-rows, UTC days,
 * with a styled hover tooltip ("3 submissions · 1 July 2026"). */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const counts = new Map(days.map((d) => [d.day, d.count]));
  const max = Math.max(...days.map((d) => d.count), 1);

  // Grid ends on today's week (Sunday-first columns, like GitHub).
  const today = new Date();
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const gridStart = todayMs - (WEEKS * 7 - 1 + ((new Date(todayMs).getUTCDay() + 1) % 7)) * DAY_MS;

  const weeks: { day: string; count: number; future: boolean }[][] = [];
  const monthLabels: { week: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const col: { day: string; count: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = gridStart + (w * 7 + d) * DAY_MS;
      const key = new Date(ms).toISOString().slice(0, 10);
      col.push({ day: key, count: counts.get(key) ?? 0, future: ms > todayMs });
    }
    const firstOfCol = new Date(gridStart + w * 7 * DAY_MS);
    if (firstOfCol.getUTCMonth() !== lastMonth && firstOfCol.getUTCDate() <= 7) {
      lastMonth = firstOfCol.getUTCMonth();
      monthLabels.push({
        week: w,
        label: firstOfCol.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      });
    }
    weeks.push(col);
  }

  function onEnter(e: React.MouseEvent<HTMLDivElement>, day: string, count: number) {
    const wrapper = e.currentTarget.closest("[data-heatmap]");
    if (!wrapper) return;
    const cell = e.currentTarget.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();
    setHover({
      day,
      count,
      x: cell.left - box.left + cell.width / 2,
      y: cell.top - box.top,
      // Flip the tooltip to the left near the right edge so it never clips.
      flip: cell.left - box.left > box.width * 0.72,
    });
  }

  return (
    <div className="relative" data-heatmap>
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          <div className="relative mb-1 h-4">
            {monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.week}`}
                className="absolute font-mono text-[10px] text-cp-faint"
                style={{ left: `${m.week * 13}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]" onMouseLeave={() => setHover(null)}>
            {weeks.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((cell) =>
                  cell.future ? (
                    <div key={cell.day} className="h-[10px] w-[10px]" />
                  ) : (
                    <div
                      key={cell.day}
                      onMouseEnter={(e) => onEnter(e, cell.day, cell.count)}
                      className={`h-[10px] w-[10px] rounded-[2px] ${cell.count === 0 ? "bg-cp-surface2" : "bg-cp-accent"} ${
                        hover?.day === cell.day ? "ring-1 ring-cp-text" : ""
                      }`}
                      style={
                        cell.count > 0 ? { opacity: LEVEL_OPACITY[level(cell.count, max)] } : undefined
                      }
                    />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[10px] text-cp-faint">
            <span>Less</span>
            <div className="h-[10px] w-[10px] rounded-[2px] bg-cp-surface2" />
            {LEVEL_OPACITY.slice(1).map((o) => (
              <div key={o} className="h-[10px] w-[10px] rounded-[2px] bg-cp-accent" style={{ opacity: o }} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[8px] border border-cp-line bg-cp-bg px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{
            left: hover.x,
            top: hover.y,
            transform: `translate(${hover.flip ? "calc(-100% + 6px)" : "-6px"}, calc(-100% - 8px))`,
          }}
        >
          <span className="font-semibold text-cp-text">
            {hover.count === 0
              ? "No submissions"
              : `${hover.count} submission${hover.count === 1 ? "" : "s"}`}
          </span>
          <span className="text-cp-dim"> on {fmtDay(hover.day)}</span>
        </div>
      ) : null}
    </div>
  );
}
