import { ArrowUpRight, LineChart, ListChecks, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ContestLeaderboard } from "@/components/contest/leaderboard";
import { LocalDate } from "@/components/local-date";
import { PlatformLogo } from "@/components/platform-logo";
import { prisma } from "@/lib/db";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

/** Platforms with a rating predictor (see server/predictions). */
const PREDICTABLE = ["CODEFORCES", "LEETCODE"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ contestId: string }>;
}): Promise<Metadata> {
  const { contestId } = await params;
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { title: true },
  });
  return {
    title: contest ? `${contest.title} — NextContest` : "Contest — NextContest",
    description: contest
      ? `Questions and the full ranking with rating changes for ${contest.title}.`
      : undefined,
  };
}

function SectionHeading({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-bold tracking-tight text-cp-text">
        {icon}
        {title}
      </h2>
      {note ? <span className="text-[12px] text-cp-faint">{note}</span> : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-[13.5px] text-cp-dim">
      {children}
    </div>
  );
}

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });

  const contest = await caller.contest.getById({ id: contestId });
  if (!contest) notFound();

  const color = platformColor(contest.platform);
  const platformLabel = PLATFORM_META[contest.platform].label;
  const nowMs = new Date().getTime();
  const started = nowMs >= contest.startTime.getTime();
  const ended = nowMs >= contest.endTime.getTime();
  const isPredictable = PREDICTABLE.includes(contest.platform);

  // Questions (LeetCode + Codeforces, once the contest has started). Server-
  // rendered; failures degrade to an omitted section.
  const questions =
    isPredictable && started ? await caller.rating.contestQuestions({ contestId }) : null;

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-[22px]">
      {/* header */}
      <header className="mb-7">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: `color-mix(in srgb, ${color} 13%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
              color,
            }}
          >
            <PlatformLogo platform={contest.platform} size={13} color={color} />
            {platformLabel}
          </span>
          {contest.difficulty ? (
            <span className="rounded-full border border-cp-line bg-cp-surface2 px-2.5 py-[3px] text-[11px] font-medium text-cp-dim">
              {contest.difficulty}
            </span>
          ) : null}
          <Link
            href="/contests/past"
            className="ml-auto shrink-0 text-[13px] text-cp-dim transition-colors hover:text-cp-text"
          >
            ← All contests
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="font-display text-[clamp(1.5rem,3.2vw,2.1rem)] font-bold tracking-[-0.02em]">
            {contest.title}
          </h1>
          <a
            href={contest.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open on ${platformLabel}`}
            className="inline-flex items-center gap-1 text-[12.5px] text-cp-faint transition-colors hover:text-cp-accent"
          >
            <ArrowUpRight className="size-3.5" /> Open on {platformLabel}
          </a>
        </div>
        <p className="mt-1 text-[14px] text-cp-dim">
          {ended ? "Ended " : started ? "Started " : "Starts "}
          <LocalDate date={ended ? contest.endTime : contest.startTime} />
        </p>

        {/* secondary actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/contests/${contest.id}/compare`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
          >
            <Swords className="size-3.5" /> Compare with friend
          </Link>
          {isPredictable ? (
            <Link
              href={`/contests/${contest.id}/predict`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
            >
              <LineChart className="size-3.5" /> Predict my rating
            </Link>
          ) : null}
        </div>
      </header>

      {!isPredictable ? (
        <Notice>
          Questions &amp; full rankings with rating changes are available for LeetCode and Codeforces
          contests for now. Use the action above to compare with a friend.
        </Notice>
      ) : (
        <div className="space-y-9">
          {/* questions */}
          {questions && questions.status === "ok" && questions.questions.length > 0 ? (
            <section>
              <SectionHeading
                icon={<ListChecks className="size-[18px] text-cp-accent" />}
                title="Questions"
                note={`${questions.questions.length} problems`}
              />
              <ol className="overflow-hidden rounded-[12px] border border-cp-line bg-cp-surface">
                {questions.questions.map((q) => (
                  <li
                    key={q.url}
                    className="flex items-center gap-3 border-b border-cp-line px-4 py-3 last:border-b-0"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-cp-bg font-mono text-[12px] font-semibold text-cp-dim">
                      {q.label}
                    </span>
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 text-[14px] font-medium text-cp-text transition-colors hover:text-cp-accent"
                    >
                      <span className="truncate">{q.title}</span>
                      <ArrowUpRight className="size-3.5 flex-none text-cp-faint" />
                    </a>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {q.rating != null ? (
                        <span
                          className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                          style={{
                            background: `color-mix(in srgb, ${color} 13%, transparent)`,
                            color,
                          }}
                        >
                          {q.rating}
                        </span>
                      ) : null}
                      {q.points != null ? (
                        <span className="rounded-full border border-cp-line bg-cp-surface2 px-2.5 py-[3px] text-[11px] font-medium text-cp-dim">
                          {q.points} pts
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* rankings */}
          <section>
            <SectionHeading
              icon={<Trophy className="size-[18px] text-cp-accent" />}
              title="Ranking & rating change"
            />
            {ended ? (
              <ContestLeaderboard contestId={contest.id} platformLabel={platformLabel} />
            ) : (
              <Notice>
                The ranking and predicted rating changes appear once the contest ends
                {started ? " — it's still running." : "."}
              </Notice>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
