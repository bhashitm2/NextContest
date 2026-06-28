import type { Metadata } from "next";

import { auth } from "@/auth";
import { ContestFeed } from "@/components/contest/contest-feed";
import { OnboardingNudge } from "@/components/onboarding-nudge";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Contests — NextContest",
  description:
    "Every upcoming competitive programming contest across Codeforces, LeetCode, AtCoder and CodeChef, in one place.",
};

export default async function UpcomingContestsPage() {
  const session = await auth();
  const needsHandles = session?.user?.id
    ? (await prisma.platformHandle.count({
        where: { userId: session.user.id, verified: true },
      })) === 0
    : false;

  return (
    <div className="animate-tab-in">
      {needsHandles ? <OnboardingNudge /> : null}
      <ContestFeed isAuthenticated={Boolean(session?.user)} />
    </div>
  );
}
