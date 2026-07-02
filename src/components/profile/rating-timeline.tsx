"use client";

import { useMemo, useState } from "react";

import type { TimelineSeries } from "@/lib/analytics";
import { PLATFORM_META, platformColor } from "@/lib/platforms";

const W = 720;
const H = 240;
const M = { left: 44, right: 12, top: 12, bottom: 24 };
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { key: "6m", label: "6M", days: 183 },
  { key: "1y", label: "1Y", days: 366 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

type Hover = {
  x: number;
  y: number;
  platform: TimelineSeries["platform"];
  at: string;
  rating: number;
  delta: number | null;
  rank: number | null;
};

/** Round a raw tick step up to a "nice" value (1/2/5 × 10^k). */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** Multi-platform SVG rating timeline with range + per-series toggles. */
export function RatingTimeline({ series }: { series: TimelineSeries[] }) {
  const [range, setRange] = useState<RangeKey>("1y");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Hover | null>(null);

  const { visible, xMin, xMax, yMin, yMax, ticks } = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    const cutoff = days == null ? -Infinity : new Date().getTime() - days * DAY_MS;

    const visible = series
      .filter((s) => !hidden.has(s.platform))
      .map((s) => ({
        ...s,
        points: s.points
          .map((p) => ({ ...p, t: Date.parse(p.at) }))
          .filter((p) => Number.isFinite(p.t) && p.t >= cutoff),
      }))
      .filter((s) => s.points.length >= 1);

    const allPoints = visible.flatMap((s) => s.points);
    if (allPoints.length === 0) {
      return { visible, xMin: 0, xMax: 1, yMin: 0, yMax: 1, ticks: [] as number[] };
    }
    let xMin = Math.min(...allPoints.map((p) => p.t));
    let xMax = Math.max(...allPoints.map((p) => p.t));
    if (xMin === xMax) {
      xMin -= DAY_MS * 15;
      xMax += DAY_MS * 15;
    }
    const rawMin = Math.min(...allPoints.map((p) => p.rating));
    const rawMax = Math.max(...allPoints.map((p) => p.rating));
    const step = niceStep(Math.max((rawMax - rawMin) / 4, 25));
    const yMin = Math.floor((rawMin - step * 0.25) / step) * step;
    const yMax = Math.ceil((rawMax + step * 0.25) / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    return { visible, xMin, xMax, yMin, yMax, ticks };
  }, [series, range, hidden]);

  const sx = (t: number) => M.left + ((t - xMin) / (xMax - xMin)) * (W - M.left - M.right);
  const sy = (r: number) => H - M.bottom - ((r - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    let best: Hover | null = null;
    let bestDist = Infinity;
    for (const s of visible) {
      for (const p of s.points) {
        const dx = sx(p.t) - px;
        const dy = sy(p.rating) - py;
        // Favor horizontal proximity so tightly-stacked lines stay pickable.
        const dist = dx * dx * 2 + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = {
            x: sx(p.t),
            y: sy(p.rating),
            platform: s.platform,
            at: p.at,
            rating: p.rating,
            delta: p.delta,
            rank: p.rank,
          };
        }
      }
    }
    setHover(best);
  }

  const toggle = (platform: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {series.map((s) => {
            const off = hidden.has(s.platform);
            return (
              <button
                key={s.platform}
                type="button"
                onClick={() => toggle(s.platform)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-opacity ${
                  off ? "border-cp-line text-cp-faint opacity-50" : "border-cp-line text-cp-text"
                }`}
                style={off ? undefined : { borderColor: platformColor(s.platform) }}
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: platformColor(s.platform), opacity: off ? 0.4 : 1 }}
                />
                {PLATFORM_META[s.platform].short} · {s.handle}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-[7px] px-2 py-1 font-mono text-[11px] ${
                range === r.key
                  ? "bg-cp-surface2 text-cp-text"
                  : "text-cp-faint hover:text-cp-dim"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Contest rating over time"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={sy(v)}
                y2={sy(v)}
                stroke="var(--cp-line)"
                strokeWidth="1"
              />
              <text
                x={M.left - 6}
                y={sy(v) + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {v}
              </text>
            </g>
          ))}
          {visible.length > 0 ? (
            <>
              <text
                x={M.left}
                y={H - 6}
                fontSize="10"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {fmtDate(new Date(xMin).toISOString())}
              </text>
              <text
                x={W - M.right}
                y={H - 6}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--cp-faint)"
              >
                {fmtDate(new Date(xMax).toISOString())}
              </text>
            </>
          ) : (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fontSize="12"
              fill="var(--cp-dim)"
            >
              No contests in this range
            </text>
          )}
          {visible.map((s) => (
            <g key={s.platform}>
              {s.points.length >= 2 ? (
                <polyline
                  points={s.points.map((p) => `${sx(p.t)},${sy(p.rating)}`).join(" ")}
                  fill="none"
                  stroke={platformColor(s.platform)}
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              ) : null}
              {s.points.map((p) => (
                <circle
                  key={p.at}
                  cx={sx(p.t)}
                  cy={sy(p.rating)}
                  r={s.points.length > 60 ? 0 : 2.25}
                  fill={platformColor(s.platform)}
                />
              ))}
            </g>
          ))}
          {hover ? (
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4"
              fill="none"
              stroke={platformColor(hover.platform)}
              strokeWidth="2"
            />
          ) : null}
        </svg>

        {hover ? (
          <div
            className="pointer-events-none absolute z-10 rounded-[8px] border border-cp-line bg-cp-surface px-2.5 py-1.5 text-[11px] shadow-md"
            style={{
              left: `${(hover.x / W) * 100}%`,
              top: `${(hover.y / H) * 100}%`,
              transform: `translate(${hover.x > W * 0.7 ? "-105%" : "8px"}, -110%)`,
            }}
          >
            <div className="font-mono text-cp-faint">
              {PLATFORM_META[hover.platform].short} ·{" "}
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
