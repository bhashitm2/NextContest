"use client";

import { Check, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { DifficultyBadge } from "@/components/practice/difficulty-badge";
import { api } from "@/trpc/react";

type ListData = RouterOutputs["practice"]["list"];

// Boundaries mirror difficultyTier() in lib/practice.ts.
const DIFFICULTY_BANDS = [
  { label: "All", min: 0, max: Infinity },
  { label: "Easy", min: 0, max: 1299 },
  { label: "Medium", min: 1300, max: 1899 },
  { label: "Hard", min: 1900, max: Infinity },
];

/** The /practice catalog: searchable, difficulty-filterable problem rows with
 * solved ticks (and DRAFT badges when the viewer is the admin). */
export function ProblemList({ initialData }: { initialData: ListData }) {
  const list = api.practice.list.useQuery(undefined, { initialData });
  const [search, setSearch] = useState("");
  const [band, setBand] = useState(0);

  const { problems, solvedSlugs, isAdmin } = list.data;
  const solved = useMemo(() => new Set(solvedSlugs), [solvedSlugs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { min, max } = DIFFICULTY_BANDS[band];
    return problems.filter(
      (p) =>
        p.difficulty >= min &&
        p.difficulty <= max &&
        (!q || p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [problems, search, band]);

  if (problems.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-12 text-center">
        <p className="text-[15px] font-semibold text-cp-text">No problems yet</p>
        <p className="mx-auto mt-1 max-w-[380px] text-[13px] text-cp-dim">
          The problem bank is being stocked — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cp-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or tag…"
            className="w-full rounded-[10px] border border-cp-line bg-cp-surface py-2 pl-9 pr-3 text-[14px] text-cp-text placeholder:text-cp-faint focus:border-cp-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {DIFFICULTY_BANDS.map((b, i) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setBand(i)}
              className={`rounded-lg px-2.5 py-1.5 font-mono text-[12px] transition-colors ${
                band === i
                  ? "bg-cp-accent font-bold text-cp-accent-ink"
                  : "border border-cp-line text-cp-dim hover:text-cp-text"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-cp-line bg-cp-surface">
        <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-cp-line px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-cp-faint">
          <span />
          <span>Problem</span>
          <span>Difficulty</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-cp-dim">No problems match.</p>
        ) : (
          <ul>
            {visible.map((p, i) => (
              <li key={p.slug} className={i > 0 ? "border-t border-cp-line" : ""}>
                <Link
                  href={`/practice/${p.slug}`}
                  className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-cp-bg-soft"
                >
                  <span className="grid place-items-center">
                    {solved.has(p.slug) ? (
                      <Check className="size-4 text-emerald-500" aria-label="Solved" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-cp-text">
                        {p.title}
                      </span>
                      {isAdmin && p.status === "DRAFT" ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-500">
                          Draft
                        </span>
                      ) : null}
                    </span>
                    {p.tags.length > 0 ? (
                      <span className="mt-0.5 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span key={t} className="font-mono text-[11px] text-cp-faint">
                            {t}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <DifficultyBadge difficulty={p.difficulty} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
