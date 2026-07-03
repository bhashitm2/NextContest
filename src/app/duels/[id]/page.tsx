import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DuelView } from "@/components/duel/duel-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { DUEL_FORMATS, type DuelFormatKey } from "@/lib/duel";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duel — NextContest",
};

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });

  let state;
  try {
    state = await caller.duel.state({ duelId: id });
  } catch {
    notFound(); // not a participant / no such duel
  }

  const format = DUEL_FORMATS[state.format as DuelFormatKey]?.label ?? state.format;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Duel"
        subtitle={`${format} · ${state.problemCount} problems · rating ${state.ratingMin}–${state.ratingMax}`}
        action={
          <Link
            href="/duels"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:border-cp-accent hover:text-cp-text"
          >
            <ArrowLeft className="size-4" />
            All duels
          </Link>
        }
      />
      <DuelView duelId={id} initialState={state} />
    </main>
  );
}
