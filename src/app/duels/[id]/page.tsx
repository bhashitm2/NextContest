import { ArrowLeft, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DuelView } from "@/components/duel/duel-view";
import { ProblemTable } from "@/components/duel/problem-table";
import { ScoreHeader } from "@/components/duel/score-header";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { DUEL_FORMATS, type DuelFormatKey } from "@/lib/duel";
import { parseProblems, scoreOf } from "@/server/duel/judge";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const duel = await prisma.duel.findUnique({
    where: { id },
    select: {
      status: true,
      format: true,
      startedAt: true,
      problems: true,
      challengerHandle: true,
      opponentHandle: true,
    },
  });
  if (!duel || duel.status !== "FINISHED" || !duel.startedAt) {
    return { title: "Duel" };
  }
  const problems = parseProblems(duel.problems);
  const a = scoreOf(problems, duel.startedAt, "A").solved;
  const b = scoreOf(problems, duel.startedAt, "B").solved;
  const format = DUEL_FORMATS[duel.format as DuelFormatKey]?.label ?? duel.format;
  return {
    title: `${duel.challengerHandle} ${a}–${b} ${duel.opponentHandle} · ${format} duel`,
  };
}

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });

  const backLink = (
    <Link
      href="/duels"
      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
    >
      <ArrowLeft className="size-4" />
      All duels
    </Link>
  );

  // Participant path: full live view.
  let participant: {
    state: Awaited<ReturnType<typeof caller.duel.state>>;
    h2h: Awaited<ReturnType<typeof caller.duel.h2h>>;
  } | null = null;
  if (session?.user?.id) {
    try {
      const [state, h2h] = await Promise.all([
        caller.duel.state({ duelId: id }),
        caller.duel.h2h({ duelId: id }),
      ]);
      participant = { state, h2h };
    } catch {
      // not a participant — fall through to the public finished-duel view
    }
  }

  if (participant) {
    const { state, h2h } = participant;
    const format = DUEL_FORMATS[state.format as DuelFormatKey]?.label ?? state.format;

    return (
      <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-[22px]">
        <PageHeader
          title="Duel"
          subtitle={`${format} · ${state.problemCount} problems · rating ${state.ratingMin}–${state.ratingMax}`}
          action={backLink}
        />
        <DuelView duelId={id} initialState={state} initialH2h={h2h} />
      </main>
    );
  }

  // Spectator path: FINISHED duels are publicly viewable (read-only summary).
  let result;
  try {
    result = await caller.duel.publicResult({ duelId: id });
  } catch {
    notFound();
  }

  const format = DUEL_FORMATS[result.format as DuelFormatKey]?.label ?? result.format;
  const winner =
    result.draw || !result.winnerId
      ? null
      : result.winnerId === result.challengerId
        ? result.challenger
        : result.opponent;
  const banner = winner
    ? `${winner.name ?? `@${winner.username}`} takes it. 🏆`
    : "Dead heat — it ended in a draw.";

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Duel result"
        subtitle={`${format} · ${result.problemCount} problems · rating ${result.ratingMin}–${result.ratingMax}`}
        action={backLink}
      />
      <div className="space-y-4">
        <p className="text-center text-[15px] font-semibold text-cp-text">{banner}</p>
        <ScoreHeader state={result} />
        <ProblemTable state={result} />
        <div className="flex justify-center pt-1">
          <Link
            href="/duels"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
          >
            <Swords className="size-4" />
            Start your own duel
          </Link>
        </div>
      </div>
    </main>
  );
}
