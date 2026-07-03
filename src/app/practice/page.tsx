import type { Metadata } from "next";

import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ProblemList } from "@/components/practice/problem-list";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice — NextContest",
  description:
    "Solve original practice problems in C++, Python or Java and get instant verdicts from the NextContest judge.",
};

export default async function PracticePage() {
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });
  const list = await caller.practice.list();

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Practice"
        badge={
          <span className="rounded-md bg-amber-500/15 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-amber-500">
            🚧 Under construction
          </span>
        }
        subtitle="Original problems, instant verdicts — write C++, Python or Java right here."
      />
      <div className="mb-5 rounded-[12px] border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-[13.5px] text-cp-dim">
        We&apos;re stocking the problem bank and bringing the judge online — practice problems will
        start appearing here very soon.
      </div>
      {/* Under construction: the catalog is admin-only until the judge goes
          live. Drop this guard (render ProblemList unconditionally) at launch. */}
      {list.isAdmin ? (
        <ProblemList initialData={list} />
      ) : (
        <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-16 text-center">
          <p className="text-[17px] font-semibold text-cp-text">Opening soon</p>
          <p className="mx-auto mt-1.5 max-w-[400px] text-[13.5px] text-cp-dim">
            Solve original problems in C++, Python or Java and get instant verdicts — right here,
            no external judge account needed.
          </p>
        </div>
      )}
    </main>
  );
}
