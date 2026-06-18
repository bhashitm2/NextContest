"use client";

import { Bookmark } from "lucide-react";
import { signIn } from "next-auth/react";

import { AddToCalendar } from "@/components/contest/add-to-calendar";
import type { Contest } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export type BookmarkState = { notify24h: boolean; notify1h: boolean } | undefined;

export function CardActions({
  contest,
  isAuthenticated,
  bookmark,
}: {
  contest: Contest;
  isAuthenticated: boolean;
  bookmark: BookmarkState;
}) {
  const utils = api.useUtils();
  const refresh = () => utils.bookmark.getForUser.invalidate();
  const toggle = api.bookmark.toggle.useMutation({ onSuccess: refresh });
  const updatePrefs = api.bookmark.updatePrefs.useMutation({ onSuccess: refresh });

  const bookmarked = bookmark !== undefined;

  return (
    <div className="mt-auto flex flex-col gap-3 px-[17px] pb-[17px] pt-[15px]">
      {bookmarked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] uppercase tracking-wide text-cp-faint">Remind me</span>
          <ReminderChip
            label="24h before"
            active={bookmark.notify24h}
            disabled={updatePrefs.isPending}
            onClick={() => updatePrefs.mutate({ contestId: contest.id, notify24h: !bookmark.notify24h })}
          />
          <ReminderChip
            label="1h before"
            active={bookmark.notify1h}
            disabled={updatePrefs.isPending}
            onClick={() => updatePrefs.mutate({ contestId: contest.id, notify1h: !bookmark.notify1h })}
          />
        </div>
      ) : null}

      <div className="flex gap-[9px]">
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => (isAuthenticated ? toggle.mutate({ contestId: contest.id }) : signIn())}
          title={isAuthenticated ? undefined : "Sign in to bookmark and get reminders"}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border text-[13px] font-semibold transition-colors disabled:opacity-60",
            !bookmarked && "border-cp-line-strong bg-cp-surface text-cp-text hover:border-cp-accent",
          )}
          style={
            bookmarked
              ? {
                  background: "color-mix(in srgb, var(--cp-accent) 14%, transparent)",
                  borderColor: "color-mix(in srgb, var(--cp-accent) 35%, transparent)",
                  color: "var(--cp-accent)",
                }
              : undefined
          }
        >
          <Bookmark className="size-[15px]" fill={bookmarked ? "currentColor" : "none"} />
          {bookmarked ? "Saved" : "Bookmark"}
        </button>
        <AddToCalendar contest={contest} />
      </div>
    </div>
  );
}

function ReminderChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
        !active && "border-cp-line text-cp-faint hover:text-cp-dim",
      )}
      style={
        active
          ? {
              background: "color-mix(in srgb, var(--cp-accent) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--cp-accent) 30%, transparent)",
              color: "var(--cp-accent)",
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}
