import type { ContestSummary, Streaks } from "@/lib/analytics";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] border border-cp-line bg-cp-bg px-3 py-2.5">
      <div className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">{label}</div>
      <div className="mt-0.5 font-display text-[22px] font-bold leading-none tracking-tight">
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-cp-dim">{sub}</div> : null}
    </div>
  );
}

/** Summary strip of the analytics section: streaks + recent contest form. */
export function AnalyticsTiles({
  streaks,
  summary,
}: {
  streaks: Streaks | null;
  summary: ContestSummary;
}) {
  const tiles = [
    streaks ? (
      <Tile
        key="streak"
        label="Streak"
        value={`${streaks.current}d`}
        sub={`longest ${streaks.longest}d`}
      />
    ) : null,
    streaks ? (
      <Tile key="active" label="Active days" value={streaks.activeDays.toLocaleString()} sub="all time" />
    ) : null,
    // Hide contest-form tiles entirely when there's been no rated activity —
    // "Contests 0" next to real streak data reads like an error.
    summary.contestsThisMonth > 0 || summary.netDelta90d != null ? (
      <Tile
        key="month"
        label="Contests"
        value={String(summary.contestsThisMonth)}
        sub="this month"
      />
    ) : null,
    summary.bestRank90d != null ? (
      <Tile
        key="rank"
        label="Best rank"
        value={`#${summary.bestRank90d.toLocaleString()}`}
        sub="last 90 days"
      />
    ) : null,
    summary.netDelta90d != null ? (
      <Tile
        key="delta"
        label="Rating Δ"
        value={`${summary.netDelta90d >= 0 ? "+" : ""}${summary.netDelta90d}`}
        sub="last 90 days"
      />
    ) : null,
  ].filter(Boolean);

  if (tiles.length === 0) return null;
  const cols =
    tiles.length >= 5
      ? "sm:grid-cols-5"
      : tiles.length === 4
        ? "sm:grid-cols-4"
        : tiles.length === 3
          ? "sm:grid-cols-3"
          : "sm:grid-cols-2";
  return <div className={`grid grid-cols-2 gap-2.5 ${cols}`}>{tiles}</div>;
}
