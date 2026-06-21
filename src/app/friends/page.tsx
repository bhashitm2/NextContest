import type { Metadata } from "next";

import { auth } from "@/auth";
import { FriendsManager } from "@/components/friends/friends-manager";
import { SignInPrompt } from "@/components/profile/sign-in-prompt";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends — NextContest",
  description: "Add friends by CodeTag and compare your competitive-programming profiles head-to-head.",
};

export default async function FriendsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <SignInPrompt
        redirectTo="/friends"
        title="Find your CP friends"
        subtitle="Sign in to add friends by CodeTag and compare your coding profiles head-to-head."
      />
    );
  }

  // Server-prefetch the friends list + pending count so they paint instantly.
  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const [friends, pendingCount, user] = await Promise.all([
    caller.friend.list(),
    caller.friend.pendingCount(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6">
        <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
          Friends
        </h1>
        <p className="mt-1 text-[15px] text-cp-dim">
          Add friends by CodeTag, then compare your profiles head-to-head.
        </p>
      </header>

      <FriendsManager
        myUsername={user?.username ?? null}
        initialFriends={friends}
        initialPendingCount={pendingCount}
      />
    </main>
  );
}
