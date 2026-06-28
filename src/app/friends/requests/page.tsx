import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { RequestsView } from "@/components/friends/requests-view";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Requests — NextContest",
};

export default async function RequestsPage() {
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user?.id) notFound();

  // Server-prefetch so the lists paint on first render (no client round-trip).
  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const [incoming, outgoing] = await Promise.all([
    caller.friend.incoming(),
    caller.friend.outgoing(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-[22px]">
      <header className="mb-5">
        <Link
          href="/friends"
          className="text-[13px] text-cp-dim transition-colors hover:text-cp-text"
        >
          ← Friends
        </Link>
        <h1 className="mt-1 font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-[-0.02em]">
          Requests
        </h1>
      </header>

      <RequestsView initialIncoming={incoming} initialOutgoing={outgoing} />
    </main>
  );
}
