import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DuelsManager } from "@/components/duel/duels-manager";
import { NewDuelLauncher } from "@/components/duel/new-duel-dialog";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duels",
  description:
    "Challenge a friend to a Codeforces duel: same unsolved problems, one clock, may the faster coder win.",
};

export default async function DuelsPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const list = await caller.duel.list();

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Duels"
        subtitle="Same problems, one clock — challenge a friend on Codeforces."
        action={<NewDuelLauncher />}
      />

      <DuelsManager myId={session.user.id} initialList={list} />
    </main>
  );
}
