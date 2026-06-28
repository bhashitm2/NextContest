import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CompareStage } from "@/components/compare/compare-stage";
import { loadComparison } from "@/server/compare/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare — NextContest",
};

export default async function ComparePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user?.id) notFound();

  const outcome = await loadComparison(session.user.id, username);

  if (outcome.status === "not-found") notFound();

  if (outcome.status === "not-friends") {
    return (
      <main className="mx-auto w-full max-w-[720px] px-4 py-16 text-center sm:px-[22px]">
        <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-[-0.02em]">
          Add {outcome.targetLabel} first
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-cp-dim">
          You can only compare with friends. Send {outcome.targetLabel} a request, then compare once
          they accept.
        </p>
        <Link
          href="/friends"
          className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
        >
          Go to Friends
        </Link>
      </main>
    );
  }

  const { result, targetLabel, isSelf, hasData, viewerHasData } = outcome.comparison;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-[-0.02em]">
            Head-to-head
          </h1>
          <p className="mt-1 text-[14px] text-cp-dim">
            {isSelf ? "Your profile" : `You vs ${targetLabel}`} — by rating, problems, and topics.
          </p>
        </div>
        <Link
          href="/friends"
          className="shrink-0 text-[13px] text-cp-dim transition-colors hover:text-cp-text"
        >
          ← Friends
        </Link>
      </header>

      {hasData ? (
        <CompareStage result={result} username={username} />
      ) : (
        <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-cp-dim">
          {!viewerHasData
            ? "Add and verify a coding profile in Settings to compare."
            : `${targetLabel} hasn't verified any coding profiles yet.`}
        </div>
      )}
    </main>
  );
}
