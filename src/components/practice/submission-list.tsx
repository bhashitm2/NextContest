"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { LANGUAGE_OPTIONS, VERDICT_META } from "@/lib/practice";
import { api } from "@/trpc/react";

type Submission = RouterOutputs["practice"]["get"]["mySubmissions"][number];

function timeAgo(date: Date): string {
  const sec = Math.max(0, Math.round((new Date().getTime() - date.getTime()) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function SubmissionRow({ submission }: { submission: Submission }) {
  const [open, setOpen] = useState(false);
  const meta = VERDICT_META[submission.verdict];
  const lang =
    LANGUAGE_OPTIONS.find((l) => l.value === submission.language)?.label ?? submission.language;

  const source = api.practice.submissionSource.useQuery(
    { id: submission.id },
    { enabled: open, staleTime: Infinity },
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-cp-bg-soft"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-cp-faint" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-cp-faint" />
        )}
        <span className="w-10 font-mono text-[12px] font-bold" style={{ color: meta.color }}>
          {submission.verdict}
        </span>
        <span className="font-mono text-[12px] text-cp-dim">
          {submission.passedCount}/{submission.totalCount}
        </span>
        <span className="text-[12px] text-cp-dim">{lang}</span>
        {submission.timeMs != null ? (
          <span className="font-mono text-[11px] text-cp-faint">{submission.timeMs}ms</span>
        ) : null}
        <span className="ml-auto text-[11px] text-cp-faint">{timeAgo(submission.createdAt)}</span>
      </button>
      {open ? (
        <div className="border-t border-cp-line bg-cp-bg-soft px-3.5 py-2.5">
          {source.isLoading ? (
            <Loader2 className="size-4 animate-spin text-cp-faint" />
          ) : source.data ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-cp-text">
              {source.data.source}
            </pre>
          ) : (
            <p className="text-[12px] text-cp-dim">Could not load the code.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** The viewer's recent submissions for one problem (Submissions tab). Rows
 * expand to show the submitted code. */
export function SubmissionList({
  submissions,
  isAuthed,
}: {
  submissions: Submission[];
  isAuthed: boolean;
}) {
  if (!isAuthed) {
    return (
      <p className="px-1 py-6 text-center text-[13px] text-cp-dim">
        Sign in to see your submissions.
      </p>
    );
  }
  if (submissions.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[13px] text-cp-dim">
        No submissions yet — solve it first!
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-cp-line bg-cp-surface">
      <ul className="divide-y divide-cp-line">
        {submissions.map((s) => (
          <SubmissionRow key={s.id} submission={s} />
        ))}
      </ul>
    </div>
  );
}
