import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "@/components/json-ld";
import { ForecastCard } from "@/components/predict/forecast-card";
import { ProfileBody } from "@/components/profile/profile-body";
import { avatarSrc } from "@/lib/avatar";
import { prisma } from "@/lib/db";
import { totalSolved } from "@/lib/profile";
import { absoluteUrl } from "@/lib/site";
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

// Memoized per request: generateMetadata and the page body both need it.
const getProfile = cache(async (usernameRaw: string) => {
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
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Profile not found" };

  const display = profile.name ?? profile.username ?? username;
  const solved = totalSolved(profile.handles);
  const title = display;
  const description =
    profile.handles.length > 0
      ? `${solved.toLocaleString()} problems solved across ${profile.handles.length} platform${profile.handles.length > 1 ? "s" : ""}.`
      : `${display}'s competitive programming profile.`;
  const canonical = `/u/${profile.username ?? username}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "profile" },
    // `handles` is already filtered to verified ones, so an empty list means an
    // empty page. Keep those out of the index (but let the crawler follow out)
    // rather than padding the site with hundreds of contentless profiles.
    robots: profile.handles.length > 0 ? undefined : { index: false, follow: true },
  };
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
      {/* Only emitted for profiles with a verified handle — the same predicate
          that decides indexability in generateMetadata. */}
      {profile.handles.length > 0 ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            dateModified: profile.handles
              .map((h) => h.lastSynced)
              .filter(Boolean)
              .sort()
              .at(-1)
              ?.toISOString(),
            mainEntity: {
              "@type": "Person",
              name: display,
              alternateName: profile.handles.map((h) => h.handle),
              url: absoluteUrl(`/u/${profile.username}`),
            },
          }}
        />
      ) : null}
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
        <div className="space-y-6">
          <ProfileBody handles={profile.handles} />
          <ForecastCard username={profile.username!} />
        </div>
      )}

      <footer className="mt-10 text-center text-[13px] text-cp-dim">
        <Link href="/" className="hover:text-cp-accent">
          Tracked with NextContest
        </Link>
      </footer>
    </main>
  );
}
