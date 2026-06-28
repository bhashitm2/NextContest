"use client";

import { ChevronLeft, ChevronRight, Clock, Loader2, Search } from "lucide-react";
import { useState } from "react";

import type { LeaderboardRow } from "@/server/predictions/leetcode/leaderboard";
import { api } from "@/trpc/react";

const PAGE_SIZE = 50;
const GAIN = "#22c55e";
const LOSS = "#f43f5e";
const deltaColor = (d: number) => (d > 0 ? GAIN : d < 0 ? LOSS : "var(--cp-dim)");

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-[13.5px] text-cp-dim">
      {children}
    </div>
  );
}

/** One ranklist row. `pinned` styles a searched handle's highlighted row. */
function Row({ row, pinned }: { row: LeaderboardRow; pinned?: boolean }) {
  const d = row.delta;
  return (
    <div
      className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-cp-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[3.5rem_1fr_5rem_7rem_4.5rem]"
      style={
        pinned
          ? {
              background: "color-mix(in srgb, var(--cp-accent) 10%, transparent)",
              borderColor: "color-mix(in srgb, var(--cp-accent) 35%, transparent)",
            }
          : undefined
      }
    >
      <span className="font-mono text-[13px] text-cp-dim">#{row.rank.toLocaleString()}</span>

      <a
        href={`https://leetcode.com/u/${encodeURIComponent(row.userSlug)}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-[13.5px] font-semibold text-cp-text transition-colors hover:text-cp-accent"
      >
        {row.username}
      </a>

      <span className="hidden text-right font-mono text-[12.5px] text-cp-dim sm:block">
        {row.score != null ? row.score : "—"}
      </span>

      <span className="hidden text-right font-mono text-[12px] text-cp-dim sm:block">
        {row.oldRating != null && row.newRating != null ? `${row.oldRating} → ${row.newRating}` : "—"}
      </span>

      <span
        className="text-right font-display text-[15px] font-bold leading-none"
        style={{ color: d != null ? deltaColor(d) : "var(--cp-faint)" }}
      >
        {d != null ? `${d > 0 ? "+" : ""}${d}` : "—"}
      </span>
    </div>
  );
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[3rem_1fr_auto] gap-3 border-b border-cp-line px-3 py-2 font-mono text-[10.5px] uppercase tracking-wide text-cp-faint sm:grid-cols-[3.5rem_1fr_5rem_7rem_4.5rem]">
      <span>Rank</span>
      <span>User</span>
      <span className="hidden text-right sm:block">Score</span>
      <span className="hidden text-right sm:block">Rating</span>
      <span className="text-right">Δ pred.</span>
    </div>
  );
}

export function ContestLeaderboard({ contestId }: { contestId: string }) {
  const [page, setPage] = useState(1);
  const [handleInput, setHandleInput] = useState("");
  const [searchHandle, setSearchHandle] = useState<string | null>(null);

  const lb = api.rating.leaderboard.useQuery(
    { contestId, page, size: PAGE_SIZE },
    { retry: false, refetchOnWindowFocus: false },
  );

  const found = api.rating.findInLeaderboard.useQuery(
    { contestId, handle: searchHandle ?? "_" },
    { enabled: !!searchHandle, retry: false, refetchOnWindowFocus: false },
  );

  if (lb.isLoading) {
    return (
      <Card>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading the ranking…
        </span>
      </Card>
    );
  }

  const data = lb.data;
  if (!data || data.status === "not-found" || data.status === "unsupported") {
    return <Card>Rankings are available for LeetCode contests.</Card>;
  }
  if (data.status === "computing") {
    return (
      <Card>
        <p className="font-display text-[15px] font-semibold text-cp-text">
          Predictions are being computed
        </p>
        <p className="mx-auto mt-1.5 max-w-md">
          The ranking with rating changes appears about 30 minutes after the contest ends. Check back
          shortly.
        </p>
      </Card>
    );
  }
  if (data.status === "unavailable") {
    return (
      <Card>
        <p className="font-display text-[15px] font-semibold text-cp-text">Ranking unavailable</p>
        <p className="mx-auto mt-1.5 max-w-md">
          The predictor service may be waking up — try again in a minute.
        </p>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {/* find-a-handle search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const h = handleInput.trim();
          setSearchHandle(h.length > 0 ? h : null);
        }}
        className="flex gap-2"
      >
        <input
          value={handleInput}
          onChange={(e) => setHandleInput(e.target.value)}
          placeholder="Find a handle in this contest…"
          className="h-10 w-full rounded-[10px] border border-cp-line bg-cp-bg px-3.5 text-sm text-cp-text outline-none focus:border-cp-accent"
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-4 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
        >
          <Search className="size-4" /> Find
        </button>
      </form>

      {searchHandle ? (
        <div className="overflow-hidden rounded-[12px] border border-cp-line">
          {found.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-cp-dim">
              <Loader2 className="size-4 animate-spin" /> Looking up {searchHandle}…
            </div>
          ) : found.data?.status === "ok" ? (
            <Row row={found.data.row} pinned />
          ) : (
            <div className="px-3 py-3 text-[13px] text-cp-dim">
              {found.data?.status === "computing"
                ? "Prediction still computing — check back shortly."
                : `No row for "${searchHandle}" in this contest.`}
            </div>
          )}
        </div>
      ) : null}

      {/* the ranking */}
      <div className="overflow-hidden rounded-[12px] border border-cp-line bg-cp-surface">
        <HeaderRow />
        {data.rows.map((row) => (
          <Row key={`${row.rank}-${row.userSlug}`} row={row} />
        ))}
      </div>

      {/* pager */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="font-mono text-[11.5px] text-cp-faint">
          {data.total.toLocaleString()} participants
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || lb.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-cp-line bg-cp-surface px-3 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> Prev
          </button>
          <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-cp-dim">
            {lb.isFetching ? <Clock className="size-3.5 animate-pulse" /> : null}
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || lb.isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-cp-line bg-cp-surface px-3 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent disabled:opacity-40"
          >
            Next <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
