import type { ReactNode } from "react";

import { ContestsHeader } from "@/components/contest/contests-header";

/**
 * Shared shell for the Upcoming (`/contests`) and Past (`/contests/past`) feeds.
 * Scoped to the (browse) route group so it does NOT wrap the per-contest detail
 * pages under /contests/[contestId]. The header persists across the two tabs,
 * which lets the active indicator slide and only the content (children) swap.
 */
export default function ContestsBrowseLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 py-10 sm:px-[22px]">
      <ContestsHeader />
      {children}
    </main>
  );
}
