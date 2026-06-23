import { LocalDate } from "@/components/local-date";
import { type HandleView, parseStats } from "@/lib/profile";
import { rankColor } from "@/lib/rank";

import { DifficultyBar } from "./difficulty-bar";

function Stat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string | null;
}) {
  return (
    <div className="rounded-[10px] border border-cp-line bg-cp-bg px-3 py-2.5">
      <div className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">{label}</div>
      <div
        className="mt-0.5 font-display text-[22px] font-bold leading-none tracking-tight"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-cp-dim">{sub}</div> : null}
    </div>
  );
}

/** Full verified-handle stats body — shared by the dashboard and public page. */
export function HandleStats({ handle }: { handle: HandleView }) {
  const extra = parseStats(handle.stats);
  const recent = extra.recentSolved ?? [];

  // Only show a tile when the platform actually exposes that metric — profile-only
  // platforms (GeeksforGeeks/Code360/HackerRank) have no rating or contest count,
  // so those tiles are dropped rather than shown as empty "N/A".
  const tiles = [
    handle.rating != null ? (
      <Stat
        key="rating"
        label="Rating"
        value={String(handle.rating)}
        sub={handle.maxRating != null ? `max ${handle.maxRating}` : undefined}
      />
    ) : null,
    <Stat
      key="solved"
      label="Solved"
      value={handle.problemsSolved != null ? handle.problemsSolved.toLocaleString() : "N/A"}
    />,
    <Stat
      key="rank"
      label="Rank"
      value={handle.rank ?? "N/A"}
      valueColor={rankColor(handle.platform, handle.rank)}
    />,
    extra.contests != null ? (
      <Stat key="contests" label="Contests" value={String(extra.contests)} />
    ) : null,
  ].filter(Boolean);

  const colsClass =
    tiles.length >= 4 ? "sm:grid-cols-4" : tiles.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-2 gap-2.5 ${colsClass}`}>{tiles}</div>

      {extra.difficulty ? <DifficultyBar data={extra.difficulty} /> : null}

      {recent.length > 0 ? (
        <div>
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Recent solves
          </div>
          <ul className="space-y-1">
            {recent.slice(0, 6).map((r, i) => (
              <li key={`${r.title}-${i}`} className="flex items-center justify-between gap-3 text-[13px]">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-cp-text hover:text-cp-accent"
                  >
                    {r.title}
                  </a>
                ) : (
                  <span className="truncate text-cp-text">{r.title}</span>
                )}
                <LocalDate date={new Date(r.at)} className="shrink-0 font-mono text-[11px] text-cp-dim" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
