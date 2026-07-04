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
        subtitle="Original problems, instant verdicts — write C++, Python or Java right here."
      />
      <ProblemList initialData={list} />
    </main>
  );
}
