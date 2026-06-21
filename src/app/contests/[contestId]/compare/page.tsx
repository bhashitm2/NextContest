import { Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ContestVsView } from "@/components/contest/contest-vs-view";
import { LocalDate } from "@/components/local-date";
import { SignInPrompt } from "@/components/profile/sign-in-prompt";
import { avatarSrc } from "@/lib/avatar";
import { prisma } from "@/lib/db";
import { PLATFORM_META } from "@/lib/platforms";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare on a contest — NextContest",
};

function Panel({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center">
      <p className="font-display text-[16px] font-semibold text-cp-text">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-cp-dim">{body}</p>
      {cta ? <div className="mt-5">{cta}</div> : null}
    </div>
  );
}

function PickerRow({
  friend,
  contestId,
}: {
  friend: { username: string | null; name: string | null; image: string | null };
  contestId: string;
}) {
  const label = friend.name ?? friend.username ?? "Friend";
  const src = avatarSrc(friend.image);
  return (
    <Link
      href={`/contests/${contestId}/compare?friend=${encodeURIComponent(friend.username ?? "")}`}
      className="flex items-center gap-3 rounded-[12px] border border-cp-line bg-cp-surface px-3.5 py-2.5 transition-colors hover:border-cp-accent"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-10 shrink-0 rounded-full border border-cp-line object-cover"
        />
      ) : (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-cp-accent-ink"
          style={{ background: "var(--cp-accent)" }}
        >
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        {friend.name ? (
          <div className="truncate text-[14px] font-semibold text-cp-text">{friend.name}</div>
        ) : null}
        <div className="truncate font-mono text-[12px] text-cp-dim">@{friend.username}</div>
      </div>
      <Swords className="ml-auto size-4 shrink-0 text-cp-faint" />
    </Link>
  );
}

export default async function ContestComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ friend?: string }>;
}) {
  const { contestId } = await params;
  const { friend } = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <SignInPrompt
        redirectTo={`/contests/${contestId}/compare`}
        title="Compare on a contest"
        subtitle="Sign in to see how you and a friend did on this round, head-to-head."
      />
    );
  }

  const caller = createCaller({ db: prisma, userId: session.user.id, headers: new Headers() });
  const contest = await caller.contest.getById({ id: contestId });
  if (!contest) notFound();

  const platformLabel = PLATFORM_META[contest.platform].label;

  const header = (
    <header className="mb-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.5rem,3.2vw,2.1rem)] font-bold tracking-[-0.02em]">
          Compare on this contest
        </h1>
        <Link
          href="/contests/past"
          className="shrink-0 text-[13px] text-cp-dim transition-colors hover:text-cp-text"
        >
          ← Past contests
        </Link>
      </div>
      <p className="text-[14px] text-cp-dim">
        {contest.title} · {platformLabel} · ended <LocalDate date={contest.endTime} />
      </p>
    </header>
  );

  // No friend chosen yet → show the picker.
  if (!friend) {
    const friends = await caller.contest.eligibleFriends({ contestId });
    return (
      <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-[22px]">
        {header}
        {friends.length === 0 ? (
          <Panel
            title={`No friends with a verified ${platformLabel} handle`}
            body={`To compare on this contest, you need a friend who has a verified ${platformLabel} profile. Add friends or ask them to connect their handle.`}
            cta={
              <Link
                href="/friends"
                className="inline-flex h-10 items-center rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
              >
                Go to Friends
              </Link>
            }
          />
        ) : (
          <>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
              Pick a friend
            </p>
            <div className="space-y-2">
              {friends.map((f) => (
                <PickerRow key={f.username} friend={f} contestId={contestId} />
              ))}
            </div>
          </>
        )}
      </main>
    );
  }

  // Friend chosen → run the gated comparison.
  const outcome = await caller.contest.compareOnContest({ contestId, friendUsername: friend });

  const wrap = (node: React.ReactNode) => (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-[22px]">
      {header}
      {node}
    </main>
  );

  if (outcome.status === "not-found") notFound();

  if (outcome.status === "not-friends") {
    return wrap(
      <Panel
        title={`Add ${outcome.targetLabel} first`}
        body={`You can only compare with friends. Send ${outcome.targetLabel} a request, then compare once they accept.`}
        cta={
          <Link
            href="/friends"
            className="inline-flex h-10 items-center rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
          >
            Go to Friends
          </Link>
        }
      />,
    );
  }

  if (outcome.status === "no-handle") {
    const body = outcome.viewerMissing
      ? `Verify your ${platformLabel} handle in Settings to compare on this contest.`
      : `${outcome.targetLabel} hasn't verified a ${platformLabel} handle yet.`;
    return wrap(
      <Panel
        title={`Missing a verified ${platformLabel} handle`}
        body={body}
        cta={
          outcome.viewerMissing ? (
            <Link
              href="/settings"
              className="inline-flex h-10 items-center rounded-[10px] bg-cp-accent px-4 text-sm font-semibold text-cp-accent-ink"
            >
              Connect in Settings
            </Link>
          ) : undefined
        }
      />,
    );
  }

  if (outcome.status === "pending-results") {
    return wrap(
      <Panel
        title="Results aren't in yet"
        body={`This contest just finished — ${platformLabel} hasn't published the final ratings yet. Check back after ratings update (usually within a few hours).`}
      />,
    );
  }

  if (outcome.status === "not-participated") {
    const body =
      outcome.who === "both"
        ? `Neither you nor ${outcome.targetLabel} competed in this contest.`
        : outcome.who === "viewer"
          ? "You didn't compete in this contest, so there's nothing to compare."
          : `${outcome.targetLabel} didn't compete in this contest.`;
    return wrap(<Panel title="No head-to-head here" body={body} />);
  }

  const { result, viewerUnavailable, friendUnavailable } = outcome.comparison;
  return wrap(
    <ContestVsView
      result={result}
      viewerUnavailable={viewerUnavailable}
      friendUnavailable={friendUnavailable}
    />,
  );
}
