import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileBody } from "@/components/profile/profile-body";
import { avatarSrc } from "@/lib/avatar";
import { prisma } from "@/lib/db";
import { totalSolved } from "@/lib/profile";
import { normalizeUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

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

async function getProfile(usernameRaw: string) {
  return prisma.user.findUnique({
    where: { username: normalizeUsername(usernameRaw) },
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Profile not found — NextContest" };

  const display = profile.name ?? profile.username ?? username;
  const solved = totalSolved(profile.handles);
  const title = `${display} — NextContest`;
  const description =
    profile.handles.length > 0
      ? `${solved.toLocaleString()} problems solved across ${profile.handles.length} platform${profile.handles.length > 1 ? "s" : ""}.`
      : `${display}'s competitive programming profile.`;
  return { title, description, openGraph: { title, description } };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const display = profile.name ?? profile.username!;
  const initial = display.charAt(0).toUpperCase();

  return (
    <main className="mx-auto w-full max-w-[840px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6 flex items-center gap-4">
        {avatarSrc(profile.image) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc(profile.image)!}
            alt=""
            className="size-14 rounded-full border border-cp-line object-cover"
          />
        ) : (
          <span
            className="grid size-14 place-items-center rounded-full text-xl font-bold text-cp-accent-ink"
            style={{ background: "var(--cp-accent)" }}
          >
            {initial}
          </span>
        )}
        <div>
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-[-0.02em]">
            {display}
          </h1>
          <p className="font-mono text-[13px] text-cp-dim">@{profile.username}</p>
        </div>
      </header>

      {profile.handles.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-cp-dim">
          No verified handles yet.
        </div>
      ) : (
        <ProfileBody handles={profile.handles} />
      )}

      <footer className="mt-10 text-center text-[13px] text-cp-dim">
        <Link href="/" className="hover:text-cp-accent">
          Tracked with NextContest
        </Link>
      </footer>
    </main>
  );
}
