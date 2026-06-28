"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";

import { api } from "@/trpc/react";

/**
 * Compact "Requests" entry for the Friends header. Shares the
 * `friend.pendingCount` query with FriendsManager, so the badge stays live when
 * a request is accepted elsewhere on the page.
 */
export function RequestsButton({ initialCount }: { initialCount: number }) {
  const pending = api.friend.pendingCount.useQuery(undefined, { initialData: initialCount });
  const count = pending.data ?? 0;

  return (
    <Link
      href="/friends/requests"
      className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
    >
      <UserPlus className="size-4 text-cp-accent" />
      Requests
      {count > 0 ? (
        <span className="grid min-w-[18px] place-items-center rounded-full bg-cp-accent px-1.5 text-[11px] font-bold leading-5 text-cp-accent-ink">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
