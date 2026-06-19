import type { Metadata } from "next";

import { auth } from "@/auth";
import { ContestFeed } from "@/components/contest/contest-feed";

export const metadata: Metadata = {
  title: "Upcoming Contests — NextContest",
  description:
    "Every upcoming competitive programming contest across Codeforces, LeetCode, AtCoder and CodeChef, in one place.",
};

export default async function ContestsPage() {
  const session = await auth();

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6">
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
            Upcoming Contests
          </h1>
          <span
            className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 font-mono text-[11px] text-cp-accent"
            style={{
              background: "color-mix(in srgb, var(--cp-accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cp-accent) 35%, transparent)",
            }}
          >
            <span
              className="size-1.5 rounded-full bg-cp-accent"
              style={{ animation: "livePulse 1.6s ease-in-out infinite" }}
            />
            LIVE
          </span>
        </div>
        <p className="text-[15px] text-cp-dim">
          Every upcoming round across Codeforces, LeetCode, AtCoder &amp; CodeChef — in one place.
        </p>
      </header>

      <ContestFeed isAuthenticated={Boolean(session?.user)} />
    </main>
  );
}
