import { LocalDate } from "@/components/local-date";
import { type HandleView, parseStats } from "@/lib/profile";

import { DifficultyBar } from "./difficulty-bar";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

/** Full verified-handle stats body — shared by the dashboard and public page. */
export function HandleStats({ handle }: { handle: HandleView }) {
  const extra = parseStats(handle.stats);
  const recent = extra.recentSolved ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat
          label="Rating"
          value={handle.rating != null ? String(handle.rating) : "—"}
          sub={handle.maxRating != null ? `max ${handle.maxRating}` : undefined}
        />
        <Stat
          label="Solved"
          value={handle.problemsSolved != null ? handle.problemsSolved.toLocaleString() : "—"}
        />
        <Stat label="Rank" value={handle.rank ?? "—"} />
        <Stat label="Contests" value={extra.contests != null ? String(extra.contests) : "—"} />
      </div>

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
