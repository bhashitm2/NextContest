"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { TimelineSeries } from "@/lib/analytics";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import type { Platform } from "@/generated/prisma/client";

const W = 720;
const M = { left: 46, right: 14, top: 14, bottom: 24 };
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { key: "6m", label: "6M", days: 183 },
  { key: "1y", label: "1Y", days: 366 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** Chart heights the +/− control steps through. */
const SIZES = [180, 260, 360];

type Hover = { x: number; y: number; at: string; rating: number; delta: number | null; rank: number | null };

/** Rating-tier bands per platform, matching each site's own color convention
 * (same hexes as lib/rank.ts). Drawn as faint backdrops so the chart reads
 * like the platform's native rating graph. */
const TIER_BANDS: Partial<Record<Platform, { from: number; to: number; color: string }[]>> = {
  CODEFORCES: [
    { from: 0, to: 1200, color: "#808080" },
    { from: 1200, to: 1400, color: "#008000" },
    { from: 1400, to: 1600, color: "#03A89E" },
    { from: 1600, to: 1900, color: "#0000FF" },
    { from: 1900, to: 2100, color: "#AA00AA" },
    { from: 2100, to: 2400, color: "#FF8C00" },
    { from: 2400, to: 5000, color: "#FF0000" },
  ],
  ATCODER: [
    { from: 0, to: 400, color: "#808080" },
    { from: 400, to: 800, color: "#804000" },
    { from: 800, to: 1200, color: "#008000" },
    { from: 1200, to: 1600, color: "#00C0C0" },
    { from: 1600, to: 2000, color: "#0000FF" },
    { from: 2000, to: 2400, color: "#C0C000" },
    { from: 2400, to: 2800, color: "#FF8000" },
    { from: 2800, to: 5000, color: "#FF0000" },
  ],
  CODECHEF: [
    { from: 0, to: 1400, color: "#666666" },
    { from: 1400, to: 1600, color: "#1E7D22" },
    { from: 1600, to: 1800, color: "#3366CC" },
    { from: 1800, to: 2000, color: "#9933FF" },
    { from: 2000, to: 2200, color: "#FFBF00" },
    { from: 2200, to: 2500, color: "#FF7F00" },
    { from: 2500, to: 5000, color: "#D0011B" },
  ],
  LEETCODE: [
    { from: 0, to: 1850, color: "#808080" },
    { from: 1850, to: 2200, color: "#5B8FF9" }, // Knight
    { from: 2200, to: 5000, color: "#F5A623" }, // Guardian
  ],
};

function bandColorAt(platform: Platform, rating: number): string | null {
  return TIER_BANDS[platform]?.find((b) => rating >= b.from && rating < b.to)?.color ?? null;
}

/** Round a raw tick step up to a "nice" value (1/2/5 × 10^k). */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

function fmtShort(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function deltaColor(d: number): string {
  return d > 0 ? "#22c55e" : d < 0 ? "#f43f5e" : "var(--cp-dim)";
}

/** The active platform's chart: tier-band backdrop, gradient area fill,
 * animated line, peak marker + dashed max line, crosshair hover. */
function PlatformChart({
  series,
  cutoff,
  height,
}: {
  series: TimelineSeries;
  cutoff: number;
  height: number;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const color = platformColor(series.platform);
  const H = height;

  const { points, xMin, xMax, yMin, yMax, ticks, peak } = useMemo(() => {
    const points = series.points
      .map((p) => ({ ...p, t: Date.parse(p.at) }))
      .filter((p) => Number.isFinite(p.t) && p.t >= cutoff);
    if (points.length === 0) {
      return { points, xMin: 0, xMax: 1, yMin: 0, yMax: 1, ticks: [] as number[], peak: null };
    }
    let xMin = Math.min(...points.map((p) => p.t));
    let xMax = Math.max(...points.map((p) => p.t));
    if (xMin === xMax) {
      xMin -= DAY_MS * 15;
      xMax += DAY_MS * 15;
    }
    const rawMin = Math.min(...points.map((p) => p.rating));
    const rawMax = Math.max(...points.map((p) => p.rating));
    const step = niceStep(Math.max((rawMax - rawMin) / 4, 25));
    const yMin = Math.floor((rawMin - step * 0.3) / step) * step;
    const yMax = Math.ceil((rawMax + step * 0.3) / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    const peak = points.reduce((a, b) => (b.rating >= a.rating ? b : a), points[0]);
    return { points, xMin, xMax, yMin, yMax, ticks, peak };
  }, [series, cutoff]);

  const sx = (t: number) => M.left + ((t - xMin) / (xMax - xMin)) * (W - M.left - M.right);
  const sy = (r: number) => H - M.bottom - ((r - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);

  // 4 evenly-spaced x-axis date labels.
  const xTicks = points.length > 0 ? [0, 1 / 3, 2 / 3, 1].map((f) => xMin + f * (xMax - xMin)) : [];

  const bands = (TIER_BANDS[series.platform] ?? []).filter((b) => b.to > yMin && b.from < yMax);

  const linePts = points.map((p) => `${sx(p.t)},${sy(p.rating)}`).join(" ");
  const areaPath =
    points.length >= 2
      ? `M ${sx(points[0].t)},${sy(points[0].rating)} ` +
        points
          .slice(1)
          .map((p) => `L ${sx(p.t)},${sy(p.rating)}`)
          .join(" ") +
        ` L ${sx(points[points.length - 1].t)},${H - M.bottom} L ${sx(points[0].t)},${H - M.bottom} Z`
      : null;

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

  const gradId = `rt-grad-${series.platform}`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${PLATFORM_META[series.platform].label} rating over time`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={`rt-clip-${series.platform}`}>
            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
          </clipPath>
        </defs>

        {/* Rating-tier backdrop (platform's own colors, very faint). */}
        <g clipPath={`url(#rt-clip-${series.platform})`}>
          {bands.map((b) => {
            const top = sy(Math.min(b.to, yMax));
            const bottom = sy(Math.max(b.from, yMin));
            return (
              <rect
                key={b.from}
                x={M.left}
                y={top}
                width={W - M.left - M.right}
                height={bottom - top}
                fill={b.color}
                opacity="0.07"
              />
            );
          })}
        </g>

        {/* Gridlines + y labels tinted by the tier color at that rating. */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={sy(v)}
              y2={sy(v)}
              stroke="var(--cp-line)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text
              x={M.left - 7}
              y={sy(v) + 3}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--font-mono, monospace)"
              fill={bandColorAt(series.platform, v) ?? "var(--cp-faint)"}
              opacity="0.85"
            >
              {v}
            </text>
          </g>
        ))}

        {points.length > 0 ? (
          <>
            {xTicks.map((t, i) => (
              <text
                key={i}
                x={sx(t)}
                y={H - 7}
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                fontSize="10"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {fmtShort(t)}
              </text>
            ))}

            {/* Dashed line at the peak rating in view. */}
            {peak ? (
              <line
                x1={M.left}
                x2={W - M.right}
                y1={sy(peak.rating)}
                y2={sy(peak.rating)}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="2 5"
                opacity="0.5"
              />
            ) : null}

            {areaPath ? <path d={areaPath} fill={`url(#${gradId})`} className="chart-fade-in" /> : null}

            {points.length >= 2 ? (
              <polyline
                points={linePts}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="chart-line-draw"
              />
            ) : null}

            <g className="chart-fade-in">
              {points.map((p) => (
                <circle
                  key={p.at}
                  cx={sx(p.t)}
                  cy={sy(p.rating)}
                  r={points.length > 60 ? 0 : 2.5}
                  fill="var(--cp-surface)"
                  stroke={color}
                  strokeWidth="1.5"
                />
              ))}
              {peak ? (
                <circle cx={sx(peak.t)} cy={sy(peak.rating)} r="3.5" fill={color} stroke="var(--cp-surface)" strokeWidth="1.5" />
              ) : null}
            </g>
          </>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--cp-dim)">
            No contests in this range
          </text>
        )}

        {/* Crosshair + highlighted point. */}
        {hover ? (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={M.top}
              y2={H - M.bottom}
              stroke="var(--cp-dim)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle cx={hover.x} cy={hover.y} r="4.5" fill="none" stroke={color} strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-[8px] border border-cp-line bg-cp-surface px-2.5 py-1.5 text-[11px] shadow-md"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: `translate(${hover.x > W * 0.7 ? "-105%" : "10px"}, -115%)`,
          }}
        >
          <div className="font-mono text-cp-faint">{fmtFull(hover.at)}</div>
          <div className="font-semibold text-cp-text">
            {hover.rating}
            {hover.delta != null ? (
              <span style={{ color: deltaColor(hover.delta) }}>
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
  );
}

/** Rating timeline: platform tabs swap a single chart (crossfade), with a
 * shared 6M/1Y/All range picker and a +/− chart-size control. */
export function RatingTimeline({ series }: { series: TimelineSeries[] }) {
  const [active, setActive] = useState<Platform>(series[0]?.platform);
  const [range, setRange] = useState<RangeKey>("1y");
  const [sizeIdx, setSizeIdx] = useState(1);

  const current = series.find((s) => s.platform === active) ?? series[0];
  if (!current) return null;

  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const cutoff = days == null ? -Infinity : new Date().getTime() - days * DAY_MS;

  const visible = current.points.filter((p) => {
    const t = Date.parse(p.at);
    return Number.isFinite(t) && t >= cutoff;
  });
  const latest = visible[visible.length - 1];
  const peakAll = current.points.reduce(
    (a, b) => (b.rating >= (a?.rating ?? -Infinity) ? b : a),
    current.points[0],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Platform tabs (hidden when there's nothing to swap). */}
        {series.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {series.map((s) => {
              const selected = s.platform === current.platform;
              return (
                <button
                  key={s.platform}
                  type="button"
                  onClick={() => setActive(s.platform)}
                  aria-pressed={selected}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    selected ? "text-cp-text" : "border-cp-line text-cp-faint hover:text-cp-dim"
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: platformColor(s.platform),
                          background: `color-mix(in srgb, ${platformColor(s.platform)} 12%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: platformColor(s.platform) }}
                  />
                  {PLATFORM_META[s.platform].short}
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
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
          <div className="flex items-center gap-0.5 rounded-[7px] border border-cp-line">
            <button
              type="button"
              aria-label="Decrease chart size"
              disabled={sizeIdx === 0}
              onClick={() => setSizeIdx((i) => Math.max(0, i - 1))}
              className="px-1.5 py-1 text-cp-dim hover:text-cp-text disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Increase chart size"
              disabled={sizeIdx === SIZES.length - 1}
              onClick={() => setSizeIdx((i) => Math.min(SIZES.length - 1, i + 1))}
              className="px-1.5 py-1 text-cp-dim hover:text-cp-text disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* key restarts the crossfade + line-draw whenever platform or range swaps. */}
      <div key={`${current.platform}-${range}`} className="animate-tab-in">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-0.5">
          <div className="font-mono text-[11px] text-cp-dim">
            {PLATFORM_META[current.platform].label} · {current.handle}
          </div>
          <div className="font-mono text-[11px] text-cp-dim">
            {latest ? (
              <>
                <span className="text-[13px] font-semibold text-cp-text">{latest.rating}</span>
                {latest.delta != null ? (
                  <span style={{ color: deltaColor(latest.delta) }}>
                    {" "}
                    {latest.delta > 0 ? "+" : ""}
                    {latest.delta}
                  </span>
                ) : null}
              </>
            ) : null}
            {peakAll ? <span className="text-cp-faint"> · peak {peakAll.rating}</span> : null}
          </div>
        </div>
        <PlatformChart series={current} cutoff={cutoff} height={SIZES[sizeIdx]} />
      </div>
    </div>
  );
}
