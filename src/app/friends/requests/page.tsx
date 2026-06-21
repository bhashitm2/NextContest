import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { RequestsView } from "@/components/friends/requests-view";
import { SignInPrompt } from "@/components/profile/sign-in-prompt";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Requests — NextContest",
};

export default async function RequestsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <SignInPrompt
        redirectTo="/friends/requests"
        title="Friend requests"
        subtitle="Sign in to see who wants to connect."
      />
    );
  }

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
