import type { Metadata } from "next";

import { auth } from "@/auth";
import { ContestFeed } from "@/components/contest/contest-feed";
import { JsonLd } from "@/components/json-ld";
import { OnboardingNudge } from "@/components/onboarding-nudge";
import { contestPath } from "@/lib/contest-slug";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/contests" },
  title: "Contests",
  description:
    "Every upcoming competitive programming contest across Codeforces, LeetCode, AtCoder and CodeChef, in one place.",
};

export default async function UpcomingContestsPage() {
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    // Empty headers: this is our own server render, not a client request, so it
    // must not be attributed to (or throttled as) a visitor IP.
    headers: new Headers(),
  });

  // Prefetched so the contest list ships in the HTML. This page used to render
  // only a skeleton and fetch client-side, which left the site's most important
  // page with no indexable content.
  const [initialContests, needsHandles] = await Promise.all([
    caller.contest.getAll({ status: "UPCOMING", limit: 100 }),
    session?.user?.id
      ? prisma.platformHandle
          .count({ where: { userId: session.user.id, verified: true } })
          .then((n) => n === 0)
      : Promise.resolve(false),
  ]);

  return (
    <div className="animate-tab-in">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Upcoming coding contests",
          numberOfItems: initialContests.items.length,
          itemListElement: initialContests.items.slice(0, 30).map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.title,
            url: absoluteUrl(contestPath(c)),
          })),
        }}
      />
      {needsHandles ? <OnboardingNudge /> : null}
      <ContestFeed
        isAuthenticated={Boolean(session?.user)}
        initialContests={initialContests}
      />
    </div>
  );
}
