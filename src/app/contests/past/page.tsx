import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { PastContestCard } from "@/components/contest/past-contest-card";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Past Contests — NextContest",
  description:
    "Recently finished contests across Codeforces, LeetCode, AtCoder and CodeChef — compare your performance head-to-head with a friend.",
};

const GRID = "grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3";

export default async function PastContestsPage() {
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });
  const contests = await caller.contest.finished({ limit: 200 });

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
            Past Contests
          </h1>
          <Link
            href="/contests"
            className="shrink-0 text-[13px] text-cp-dim transition-colors hover:text-cp-text"
          >
            ← Upcoming
          </Link>
        </div>
        <p className="text-[15px] text-cp-dim">
          Recently finished rounds. Pick one to compare your rank &amp; rating change head-to-head
          with a friend who also competed.
        </p>
      </header>

      {contests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cp-line-strong py-20 text-center text-cp-dim">
          No finished contests yet — check back after the next round wraps up.
        </div>
      ) : (
        <div className={GRID}>
          {contests.map((contest) => (
            <PastContestCard key={contest.id} contest={contest} />
          ))}
        </div>
      )}
    </main>
  );
}
