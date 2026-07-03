"use client";

import { Check, ExternalLink } from "lucide-react";

import type { RouterOutputs } from "@/components/friends/friend-row";

type DuelState = RouterOutputs["duel"]["state"];

/** "+37:12" — minutes:seconds from duel start to the solve. */
function solveTime(iso: string | null, startedAt: string | Date | null): string | null {
  if (!iso || !startedAt) return null;
  const sec = Math.max(0, Math.round((Date.parse(iso) - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `+${m}:${String(s).padStart(2, "0")}`;
}

function SolveCell({ at, startedAt, color }: { at: string | null; startedAt: DuelState["startedAt"]; color: string }) {
  const t = solveTime(at, startedAt);
  if (!t) return <span className="text-cp-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[12px] font-bold" style={{ color }}>
      <Check className="size-3.5" />
      {t}
    </span>
  );
}

/** The duel's problems with each player's solve status. */
export function ProblemTable({ state }: { state: DuelState }) {
  const aLabel = state.challenger.name ?? `@${state.challenger.username}`;
  const bLabel = state.opponent.name ?? `@${state.opponent.username}`;

  return (
    <div className="overflow-hidden rounded-[14px] border border-cp-line bg-cp-surface">
      <div className="grid grid-cols-[1fr_88px_88px] gap-2 border-b border-cp-line px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-cp-faint">
        <span>Problem</span>
        <span className="truncate text-center" title={aLabel}>
          {aLabel}
        </span>
        <span className="truncate text-center" title={bLabel}>
          {bLabel}
        </span>
      </div>
      <ul>
        {state.problems.map((p, i) => (
          <li
            key={p.key}
            className={`grid grid-cols-[1fr_88px_88px] items-center gap-2 px-4 py-2.5 ${
              i > 0 ? "border-t border-cp-line" : ""
            }`}
          >
            <span className="min-w-0">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex max-w-full items-center gap-1.5 text-[14px] text-cp-text hover:text-cp-accent"
              >
                <span className="truncate">{p.name}</span>
                <ExternalLink className="size-3 shrink-0 text-cp-faint group-hover:text-cp-accent" />
              </a>
              <span className="ml-2 font-mono text-[11px] text-cp-faint">{p.rating}</span>
            </span>
            <span className="text-center">
              <SolveCell at={p.solvedByA} startedAt={state.startedAt} color="var(--cp-accent)" />
            </span>
            <span className="text-center">
              <SolveCell at={p.solvedByB} startedAt={state.startedAt} color="#f59e0b" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
