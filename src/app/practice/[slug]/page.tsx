import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ProblemWorkbench } from "@/components/practice/problem-workbench";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { title: true, status: true },
  });
  const title = problem?.status === "PUBLISHED" ? problem.title : "Practice";
  return { title: `${title} — NextContest` };
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });

  let data;
  try {
    data = await caller.practice.get({ slug });
  } catch {
    notFound();
  }
  // Under construction: problem pages are admin-only until the judge goes
  // live. Remove this guard at launch.
  if (!data.isAdmin) notFound();

  return (
    // Full-bleed workbench: the pane fills the viewport below the 65px header
    // on large screens (LeetCode-style split view); stacks and scrolls on mobile.
    <main className="w-full px-3 py-3 lg:h-[calc(100dvh-65px)] lg:overflow-hidden">
      <div className="h-full">
        <ProblemWorkbench slug={slug} initialData={data} isAuthed={!!session?.user?.id} />
      </div>
    </main>
  );
}
