import { LineChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { LocalDate } from "@/components/local-date";
import { PredictionCard } from "@/components/predict/prediction-card";
import { prisma } from "@/lib/db";
import { PLATFORM_META } from "@/lib/platforms";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Predict your rating — NextContest",
};

function Panel({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center">
      <p className="font-display text-[16px] font-semibold text-cp-text">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-cp-dim">{body}</p>
      {cta ? <div className="mt-5">{cta}</div> : null}
    </div>
  );
}

export default async function ContestPredictPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user?.id) notFound();

  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const contest = await caller.contest.getById({ id: contestId });
  if (!contest) notFound();

  const platformLabel = PLATFORM_META[contest.platform].label;

  const header = (
    <header className="mb-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.5rem,3.2vw,2.1rem)] font-bold tracking-[-0.02em]">
          Rating prediction
        </h1>
        <Link
          href="/ratings"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-cp-dim transition-colors hover:text-cp-text"
        >
          <LineChart className="size-3.5" /> Look up any handle
        </Link>
      </div>
      <p className="text-[14px] text-cp-dim">
        {contest.title} · {platformLabel} · <LocalDate date={contest.endTime} />
      </p>
    </header>
  );

  const wrap = (node: React.ReactNode) => (
    <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:px-[22px]">
      {header}
      {node}
    </main>
  );

  const result = await caller.rating.forContest({ contestId });

  if (result.status === "not-found") notFound();

  if (result.status === "unsupported") {
    return wrap(
      <Panel
        title={`No predictor for ${platformLabel} yet`}
        body={`Rating prediction is available for Codeforces and LeetCode. ${platformLabel} isn't supported.`}
      />,
    );
  }

  if (result.status === "no-handle") {
    return wrap(
      <Panel
        title={`Connect your ${platformLabel} handle`}
        body={`Verify your ${platformLabel} handle in Settings to get a personalized rating prediction.`}
        cta={
          <Link
            href="/settings"
            className="inline-flex h-10 items-center rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
          >
            Connect in Settings
          </Link>
        }
      />,
    );
  }

  return wrap(
    <PredictionCard prediction={result.prediction} platform={contest.platform} handle={result.handle} />,
  );
}
