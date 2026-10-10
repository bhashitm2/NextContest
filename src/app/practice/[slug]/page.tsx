import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ProblemWorkbench } from "@/components/practice/problem-workbench";
import { JsonLd } from "@/components/json-ld";
import { prisma } from "@/lib/db";
import { difficultyTier } from "@/lib/practice";
import { absoluteUrl } from "@/lib/site";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { title: true, status: true, difficulty: true, tags: true },
  });
  if (problem?.status !== "PUBLISHED") {
    // Drafts are invisible to non-admins; don't leak the title or invite a crawl.
    return { title: "Practice", robots: { index: false, follow: false } };
  }
  const tier = difficultyTier(problem.difficulty).label;
  const description = `${problem.title} — ${tier} (${problem.difficulty}) practice problem${
    problem.tags.length ? ` on ${problem.tags.join(", ")}` : ""
  }. Solve it in C++, Python or Java and get an instant verdict from the NextContest judge.`;
  return {
    title: problem.title,
    description,
    alternates: { canonical: `/practice/${slug}` },
    openGraph: { title: problem.title, description, url: `/practice/${slug}`, type: "article" },
  };
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

  return (
    // Full-bleed workbench: the pane fills the viewport below the 65px header
    // on large screens (LeetCode-style split view); stacks and scrolls on mobile.
    <main className="w-full px-3 py-3 lg:h-[calc(100dvh-65px)] lg:overflow-hidden">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "LearningResource",
              name: data.problem.title,
              url: absoluteUrl(`/practice/${slug}`),
              learningResourceType: "Programming problem",
              educationalLevel: difficultyTier(data.problem.difficulty).label,
              keywords: data.problem.tags.join(", "),
              teaches: data.problem.tags.join(", "),
              isAccessibleForFree: true,
              inLanguage: "en",
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Practice", item: absoluteUrl("/practice") },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: data.problem.title,
                  item: absoluteUrl(`/practice/${slug}`),
                },
              ],
            },
          ],
        }}
      />
      <div className="h-full">
        <ProblemWorkbench slug={slug} initialData={data} isAuthed={!!session?.user?.id} />
      </div>
    </main>
  );
}
