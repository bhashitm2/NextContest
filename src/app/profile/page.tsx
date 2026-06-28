import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ForecastCard } from "@/components/predict/forecast-card";
import { ProfileBody } from "@/components/profile/profile-body";
import { avatarSrc } from "@/lib/avatar";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Profile — NextContest",
  description: "Your verified competitive-programming profiles and solved-problem stats across platforms.",
};

const HANDLE_SELECT = {
  platform: true,
  handle: true,
  rating: true,
  maxRating: true,
  rank: true,
  problemsSolved: true,
  stats: true,
  lastSynced: true,
} as const;

export default async function ProfilePage() {
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      image: true,
      username: true,
      handles: {
        where: { verified: true },
        select: HANDLE_SELECT,
        orderBy: { problemsSolved: "desc" },
      },
    },
  });

  const display = user?.name ?? session.user.name ?? session.user.email ?? "You";
  const initial = display.charAt(0).toUpperCase();
  const handles = user?.handles ?? [];

  return (
    <main className="mx-auto w-full max-w-[840px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        {avatarSrc(user?.image) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc(user?.image)!} alt="" className="size-14 rounded-full border border-cp-line object-cover" />
        ) : (
          <span
            className="grid size-14 place-items-center rounded-full text-xl font-bold text-cp-accent-ink"
            style={{ background: "var(--cp-accent)" }}
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-[-0.02em]">
            {display}
          </h1>
          {user?.username ? (
            <Link href={`/u/${user.username}`} className="font-mono text-[13px] text-cp-dim hover:text-cp-accent">
              @{user.username} · view public page ↗
            </Link>
          ) : (
            <p className="text-[13px] text-cp-dim">
              No public username yet —{" "}
              <Link href="/settings" className="text-cp-accent hover:underline">
                set one in Settings
              </Link>
            </p>
          )}
        </div>
        <Link
          href="/settings"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:text-cp-text"
        >
          Manage handles &amp; username
          <span aria-hidden>→</span>
        </Link>
      </header>

      {handles.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-cp-line-strong bg-cp-surface p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-cp-text">
            Connect your first handle
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-cp-dim">
            Link your Codeforces, LeetCode, AtCoder, CodeChef and more in Settings to see your
            cross-platform stats and rating forecast here.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
          >
            Manage handles &amp; username
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <ProfileBody handles={handles} />
          <ForecastCard />
        </div>
      )}
    </main>
  );
}
