import { ArrowUpRight, Crown, Minus } from "lucide-react";

import { avatarSrc } from "@/lib/avatar";
import type { ContestCategory, ContestCompareResult, ContestSide } from "@/lib/contest-compare";
import { PLATFORM_META, platformColor } from "@/lib/platforms";

// Fixed competitor colors so "you" vs "them" read consistently in any theme.
const A_COLOR = "var(--cp-accent)";
const B_COLOR = "#f59e0b";
const UP = "#22c55e";
const DOWN = "#ef4444";

function Avatar({
  image,
  label,
  ring,
  size = 60,
}: {
  image: string | null;
  label: string;
  ring: string;
  size?: number;
}) {
  const initial = label.charAt(0).toUpperCase();
  const src = avatarSrc(image);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}` }}
      className="rounded-full border border-cp-line object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size, background: ring, boxShadow: `0 0 0 3px ${ring}` }}
      className="grid place-items-center rounded-full text-2xl font-bold text-cp-accent-ink"
    >
      {initial}
    </span>
  );
}

function fmtValue(value: number, format: ContestCategory["format"]): {
  text: string;
  color?: string;
} {
  if (format === "rank") return { text: `#${value.toLocaleString()}` };
  if (format === "delta") {
    const text = value > 0 ? `+${value}` : String(value);
    return { text, color: value > 0 ? UP : value < 0 ? DOWN : undefined };
  }
  return { text: value.toLocaleString() };
}

function CategoryCard({ c }: { c: ContestCategory }) {
  const a = fmtValue(c.aValue ?? 0, c.format);
  const b = fmtValue(c.bValue ?? 0, c.format);
  return (
    <div className="rounded-[12px] border border-cp-line bg-cp-surface p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-cp-dim">{c.label}</span>
        {c.lowerIsBetter ? (
          <span className="font-mono text-[10px] uppercase tracking-wide text-cp-faint">
            lower is better
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 ${c.winner === "a" ? "" : "opacity-55"}`}>
          <span className="font-display text-[20px] font-bold leading-none" style={{ color: a.color }}>
            {a.text}
          </span>
          {c.winner === "a" ? <Crown className="size-3.5 text-cp-accent" /> : null}
        </div>
        <span className="font-mono text-[11px] text-cp-faint">vs</span>
        <div className={`flex items-center gap-1.5 ${c.winner === "b" ? "" : "opacity-55"}`}>
          {c.winner === "b" ? <Crown className="size-3.5 text-cp-accent" /> : null}
          <span className="font-display text-[20px] font-bold leading-none" style={{ color: b.color }}>
            {b.text}
          </span>
        </div>
      </div>
    </div>
  );
}

function sideLabel(side: ContestSide, fallback: string): string {
  return side.name ?? side.username ?? fallback;
}

export function ContestVsView({
  result,
  viewerUnavailable,
  friendUnavailable,
}: {
  result: ContestCompareResult;
  viewerUnavailable: boolean;
  friendUnavailable: boolean;
}) {
  const { a, b, overall, categories, platform, contestTitle, contestUrl } = result;
  const aLabel = sideLabel(a, "You");
  const bLabel = sideLabel(b, "Friend");
  const meta = PLATFORM_META[platform];
  const color = platformColor(platform);

  const winnerLabel = overall.winner === "a" ? aLabel : overall.winner === "b" ? bLabel : null;
  const hasPerformance = a.perf.performance !== null || b.perf.performance !== null;

  return (
    <div className="space-y-5">
      {/* VS hero */}
      <div className="overflow-hidden rounded-[18px] border border-cp-line bg-cp-surface">
        <div className="flex items-center justify-between gap-3 p-5 sm:p-7">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar image={a.image} label={aLabel} ring={A_COLOR} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-cp-text">{aLabel}</div>
              {a.username ? (
                <div className="truncate font-mono text-[11px] text-cp-dim">@{a.username}</div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[clamp(1.8rem,5vw,2.6rem)] font-black tracking-tight text-cp-faint">
              VS
            </span>
            <span className="font-mono text-[13px] font-bold text-cp-text">
              {overall.aScore} – {overall.bScore}
            </span>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar image={b.image} label={bLabel} ring={B_COLOR} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-cp-text">{bLabel}</div>
              {b.username ? (
                <div className="truncate font-mono text-[11px] text-cp-dim">@{b.username}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* contest subline */}
        <a
          href={contestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-cp-line px-5 py-2.5 text-[12px] font-medium transition-colors hover:opacity-80"
          style={{ color }}
        >
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          On {meta.label}: {contestTitle}
          <ArrowUpRight className="size-3" />
        </a>

        <div
          className="flex items-center justify-center gap-2 border-t border-cp-line px-5 py-3 text-[14px] font-semibold"
          style={{ background: "color-mix(in srgb, var(--cp-accent) 9%, transparent)" }}
        >
          {winnerLabel ? (
            <>
              <Crown className="size-4 text-cp-accent" />
              <span className="text-cp-text">{winnerLabel} wins this one!</span>
            </>
          ) : (
            <>
              <Minus className="size-4 text-cp-dim" />
              <span className="text-cp-dim">Evenly matched — it&apos;s a tie!</span>
            </>
          )}
        </div>
      </div>

      {/* partial-data notes */}
      {viewerUnavailable || friendUnavailable ? (
        <div className="rounded-[12px] border border-dashed border-cp-line bg-cp-surface p-4 text-[13px] text-cp-dim">
          Couldn&apos;t load {viewerUnavailable && friendUnavailable
            ? "either player's"
            : viewerUnavailable
              ? `${aLabel}'s`
              : `${bLabel}'s`}{" "}
          result from {meta.label} right now — it may be a temporary outage. Try again in a bit.
        </div>
      ) : null}

      {/* head-to-head categories */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.key} c={c} />
          ))}
        </div>
      ) : null}

      {/* AtCoder performance (informational, not scored) */}
      {hasPerformance ? (
        <div className="flex items-center justify-between rounded-[12px] border border-cp-line bg-cp-surface px-4 py-3 text-[13px]">
          <span className="text-cp-dim">Performance</span>
          <span className="font-mono text-cp-text">
            {a.perf.performance ?? "—"} <span className="text-cp-faint">vs</span>{" "}
            {b.perf.performance ?? "—"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
