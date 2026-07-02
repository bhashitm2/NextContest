"use client";

import { useMemo, useState } from "react";

import type { TimelineSeries } from "@/lib/analytics";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import type { RatingPoint } from "@/lib/profile";

const W = 400;
const H = 170;
const M = { left: 38, right: 10, top: 10, bottom: 20 };
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { key: "6m", label: "6M", days: 183 },
  { key: "1y", label: "1Y", days: 366 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

type Hover = { x: number; y: number; at: string; rating: number; delta: number | null; rank: number | null };

/** Round a raw tick step up to a "nice" value (1/2/5 × 10^k). */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

/** One platform's rating history — its own card, line and y-scale. */
function PlatformChart({ series, cutoff }: { series: TimelineSeries; cutoff: number }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const color = platformColor(series.platform);

  const { points, xMin, xMax, yMin, yMax, ticks } = useMemo(() => {
    const points = series.points
      .map((p) => ({ ...p, t: Date.parse(p.at) }))
      .filter((p) => Number.isFinite(p.t) && p.t >= cutoff);
    if (points.length === 0) {
      return { points, xMin: 0, xMax: 1, yMin: 0, yMax: 1, ticks: [] as number[] };
    }
    let xMin = Math.min(...points.map((p) => p.t));
    let xMax = Math.max(...points.map((p) => p.t));
    if (xMin === xMax) {
      xMin -= DAY_MS * 15;
      xMax += DAY_MS * 15;
    }
    const rawMin = Math.min(...points.map((p) => p.rating));
    const rawMax = Math.max(...points.map((p) => p.rating));
    const step = niceStep(Math.max((rawMax - rawMin) / 3, 25));
    const yMin = Math.floor((rawMin - step * 0.25) / step) * step;
    const yMax = Math.ceil((rawMax + step * 0.25) / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    return { points, xMin, xMax, yMin, yMax, ticks };
  }, [series, cutoff]);

  const sx = (t: number) => M.left + ((t - xMin) / (xMax - xMin)) * (W - M.left - M.right);
  const sy = (r: number) => H - M.bottom - ((r - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best: Hover | null = null;
    let bestDist = Infinity;
    for (const p of points) {
      const d = Math.abs(sx(p.t) - px);
      if (d < bestDist) {
        bestDist = d;
        best = { x: sx(p.t), y: sy(p.rating), at: p.at, rating: p.rating, delta: p.delta, rank: p.rank };
      }
    }
    setHover(best);
  }

  const latest: (RatingPoint & { t: number }) | undefined = points[points.length - 1];

  return (
    <div className="rounded-[10px] border border-cp-line bg-cp-bg p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-cp-text">{PLATFORM_META[series.platform].label}</span>
          <span className="truncate text-cp-faint">· {series.handle}</span>
        </div>
        {latest ? (
          <div className="shrink-0 font-mono text-[11px] text-cp-dim">
            <span className="font-semibold text-cp-text">{latest.rating}</span>
            {latest.delta != null ? (
              <span
                style={{
                  color: latest.delta > 0 ? "#22c55e" : latest.delta < 0 ? "#f43f5e" : "var(--cp-dim)",
                }}
              >
                {" "}
                {latest.delta > 0 ? "+" : ""}
                {latest.delta}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${PLATFORM_META[series.platform].label} rating over time`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={sy(v)} y2={sy(v)} stroke="var(--cp-line)" strokeWidth="1" />
              <text
                x={M.left - 5}
                y={sy(v) + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {v}
              </text>
            </g>
          ))}
          {points.length > 0 ? (
            <>
              <text
                x={M.left}
                y={H - 5}
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {fmtDate(xMin)}
              </text>
              <text
                x={W - M.right}
                y={H - 5}
                textAnchor="end"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {fmtDate(xMax)}
              </text>
              {points.length >= 2 ? (
                <polyline
                  points={points.map((p) => `${sx(p.t)},${sy(p.rating)}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              ) : null}
              {points.map((p) => (
                <circle key={p.at} cx={sx(p.t)} cy={sy(p.rating)} r={points.length > 60 ? 0 : 2.25} fill={color} />
              ))}
            </>
          ) : (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="var(--cp-dim)">
              No contests in this range
            </text>
          )}
          {hover ? <circle cx={hover.x} cy={hover.y} r="4" fill="none" stroke={color} strokeWidth="2" /> : null}
        </svg>

        {hover ? (
          <div
            className="pointer-events-none absolute z-10 rounded-[8px] border border-cp-line bg-cp-surface px-2.5 py-1.5 text-[11px] shadow-md"
            style={{
              left: `${(hover.x / W) * 100}%`,
              top: `${(hover.y / H) * 100}%`,
              transform: `translate(${hover.x > W * 0.65 ? "-105%" : "8px"}, -110%)`,
            }}
          >
            <div className="font-mono text-cp-faint">
              {new Date(hover.at).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
            <div className="font-semibold text-cp-text">
              {hover.rating}
              {hover.delta != null ? (
                <span
                  style={{
                    color: hover.delta > 0 ? "#22c55e" : hover.delta < 0 ? "#f43f5e" : "var(--cp-dim)",
                  }}
                >
                  {" "}
                  ({hover.delta > 0 ? "+" : ""}
                  {hover.delta})
                </span>
              ) : null}
              {hover.rank != null ? (
                <span className="font-normal text-cp-dim"> · #{hover.rank.toLocaleString()}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Per-platform rating charts (own y-scale each) behind one shared range picker. */
export function RatingTimeline({ series }: { series: TimelineSeries[] }) {
  const [range, setRange] = useState<RangeKey>("1y");
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const cutoff = days == null ? -Infinity : new Date().getTime() - days * DAY_MS;

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={`rounded-[7px] px-2 py-1 font-mono text-[11px] ${
              range === r.key ? "bg-cp-surface2 text-cp-text" : "text-cp-faint hover:text-cp-dim"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-1 gap-3 ${series.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {series.map((s) => (
          <PlatformChart key={s.platform} series={s} cutoff={cutoff} />
        ))}
      </div>
    </div>
  );
}
