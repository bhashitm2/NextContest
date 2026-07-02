"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { computeStreaks } from "@/lib/analytics";
import type { ActivityDay } from "@/lib/profile";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 4-step intensity for a day's count relative to the busiest day in view. */
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
type View = "current" | number;

type Cell = { day: string; count: number; blank: boolean };

/** GitHub-style submissions heatmap with a yearly view switcher and a
 * summary header (total submissions, active days, max streak in view). */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [view, setView] = useState<View>("current");

  const today = new Date();
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const { weeks, monthLabels, total, activeDays, maxStreak, max, years, dataStart, windowStart } =
    useMemo(() => {
      const counts = new Map(days.map((d) => [d.day, d.count]));
      const years = [...new Set(days.filter((d) => d.count > 0).map((d) => Number(d.day.slice(0, 4))))].sort(
        (a, b) => b - a,
      );
      const dataStart = days.length > 0 ? days[0].day : null;

      // Window: trailing 12 months, or one calendar year (clamped to today).
      let windowStart: number;
      let windowEnd: number;
      if (view === "current") {
        windowEnd = todayMs;
        windowStart = windowEnd - 365 * DAY_MS;
      } else {
        windowStart = Date.UTC(view, 0, 1);
        windowEnd = Math.min(Date.UTC(view, 11, 31), todayMs);
      }

      // Columns are Sunday-first weeks covering the window.
      const gridStart = windowStart - new Date(windowStart).getUTCDay() * DAY_MS;
      const weeks: Cell[][] = [];
      const monthLabels: { week: number; label: string }[] = [];
      const inWindow: ActivityDay[] = [];
      let total = 0;

      for (let colStart = gridStart, w = 0; colStart <= windowEnd; colStart += 7 * DAY_MS, w++) {
        const col: Cell[] = [];
        for (let d = 0; d < 7; d++) {
          const ms = colStart + d * DAY_MS;
          const date = new Date(ms);
          const key = date.toISOString().slice(0, 10);
          if (ms < windowStart || ms > windowEnd) {
            col.push({ day: key, count: 0, blank: true });
            continue;
          }
          const count = counts.get(key) ?? 0;
          col.push({ day: key, count, blank: false });
          inWindow.push({ day: key, count });
          total += count;
          // Label the column containing the 1st of a month.
          if (date.getUTCDate() === 1) {
            monthLabels.push({
              week: w,
              label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
            });
          }
        }
        weeks.push(col);
      }

      const streaks = computeStreaks(inWindow);
      const max = Math.max(...inWindow.map((d) => d.count), 1);
      return {
        weeks,
        monthLabels,
        total,
        activeDays: streaks.activeDays,
        maxStreak: streaks.longest,
        max,
        years,
        dataStart,
        windowStart,
      };
    }, [days, view, todayMs]);

  // Stored activity only spans the trailing ~12 months — flag a year view
  // whose window starts before the data does, so it doesn't read as "empty".
  const partialNote =
    view !== "current" && dataStart && Date.parse(`${dataStart}T00:00:00Z`) > windowStart
      ? `data starts ${fmtDay(dataStart)}`
      : null;

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
      flip: cell.left - box.left > box.width * 0.72,
    });
  }

  return (
    <div className="relative" data-heatmap>
      {/* Summary header: totals for the selected window + year switcher. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="text-[13px] text-cp-dim">
          <span className="font-display text-[16px] font-bold text-cp-text">
            {total.toLocaleString()}
          </span>{" "}
          submissions {view === "current" ? "in the past one year" : `in ${view}`}
          {partialNote ? <span className="text-[11px] text-cp-faint"> · {partialNote}</span> : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden font-mono text-[11px] text-cp-faint sm:block">
            Active days: <span className="text-cp-text">{activeDays}</span>
            <span className="mx-1.5">·</span>
            Max streak: <span className="text-cp-text">{maxStreak}</span>
          </div>
          {years.length > 0 ? (
            <div className="relative">
              <select
                aria-label="Heatmap year"
                value={String(view)}
                onChange={(e) =>
                  setView(e.target.value === "current" ? "current" : Number(e.target.value))
                }
                className="appearance-none rounded-[7px] border border-cp-line bg-cp-bg py-1 pl-2.5 pr-7 font-mono text-[11px] text-cp-text hover:border-cp-dim focus:outline-none"
              >
                <option value="current">Current</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-cp-faint" />
            </div>
          ) : null}
        </div>
      </div>

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
                  cell.blank ? (
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
