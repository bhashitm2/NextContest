import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { FriendsManager } from "@/components/friends/friends-manager";
import { RequestsButton } from "@/components/friends/requests-button";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends — NextContest",
  description: "Add friends by CodeTag and compare your competitive-programming profiles head-to-head.",
};

export default async function FriendsPage() {
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user?.id) notFound();

  // Server-prefetch the friends list + pending count so they paint instantly.
  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const [friends, pendingCount, user] = await Promise.all([
    caller.friend.list(),
    caller.friend.pendingCount(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Friends"
        subtitle="Add friends by CodeTag, then compare your profiles head-to-head."
        action={<RequestsButton initialCount={pendingCount} />}
      />

      <FriendsManager myUsername={user?.username ?? null} initialFriends={friends} />
    </main>
  );
}
