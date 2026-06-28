import type { Metadata } from "next";

import { auth } from "@/auth";
import { PastContestsFeed } from "@/components/contest/past-contests-feed";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Past Contests — NextContest",
  description:
    "Recently finished contests across Codeforces, LeetCode, AtCoder and CodeChef — compare your performance head-to-head with a friend.",
};

export default async function PastContestsPage() {
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });
  const contests = await caller.contest.finished({ limit: 200 });

  return (
    <div className="animate-tab-in">
      {contests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cp-line-strong py-20 text-center text-cp-dim">
          No finished contests yet — check back after the next round wraps up.
        </div>
      ) : (
        <PastContestsFeed contests={contests} />
      )}
    </div>
  );
}
