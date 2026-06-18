"use client";

import { AlertTriangle } from "lucide-react";

import { PLATFORM_META } from "@/lib/platforms";
import { api } from "@/trpc/react";

/**
 * Surfaces pipeline health to users: if any source hasn't synced successfully
 * recently (or errored), we say so rather than silently showing stale data.
 */
export function StaleDataBanner() {
  const { data } = api.contest.getSyncStatus.useQuery();
  if (!data) return null;

  const stale = data.filter((s) => s.isStale);
  if (stale.length === 0) return null;

  const names = stale.map((s) => PLATFORM_META[s.source]?.label ?? s.source).join(", ");

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        Contest data for <strong>{names}</strong> may be out of date — we&apos;re working to
        refresh it.
      </span>
    </div>
  );
}
