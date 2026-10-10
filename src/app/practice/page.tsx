import type { Metadata } from "next";

import { auth } from "@/auth";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { ProblemList } from "@/components/practice/problem-list";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/practice" },
  title: "Practice",
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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "NextContest practice problems",
          numberOfItems: list.problems.length,
          itemListElement: list.problems.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.title,
            url: absoluteUrl(`/practice/${p.slug}`),
          })),
        }}
      />
      <PageHeader
        title="Practice"
        subtitle="Original problems, instant verdicts — write C++, Python or Java right here."
      />
      <ProblemList initialData={list} />
    </main>
  );
}
