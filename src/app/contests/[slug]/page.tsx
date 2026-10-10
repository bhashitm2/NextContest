import { ArrowUpRight, CalendarClock, LineChart, ListChecks, Swords, Timer, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ContestLeaderboard } from "@/components/contest/leaderboard";
import { JsonLd } from "@/components/json-ld";
import { LocalDate } from "@/components/local-date";
import { PlatformLogo } from "@/components/platform-logo";
import { contestPath } from "@/lib/contest-slug";
import { formatDuration, formatStartInZone } from "@/lib/format";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import { absoluteUrl } from "@/lib/site";
import { getContestByPathParam } from "@/server/contest/by-path";
import { contestQuestions } from "@/server/contest/questions";

export const dynamic = "force-dynamic";

// NOTE: do NOT add a loading.tsx to this route, and do not move it under the
// (browse) route group (which has one). Once a Suspense fallback flushes, the
// response body has started streaming and permanentRedirect() below degrades
// from a real 308 into a client-side meta refresh, which search engines treat
// very differently.

/** Platforms with a rating predictor (see server/predictions). */
const PREDICTABLE = ["CODEFORCES", "LEETCODE"];

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const contest = await getContestByPathParam(slug);
  if (!contest) return { title: "Contest" };

  const platformLabel = PLATFORM_META[contest.platform].label;
  const when = formatStartInZone(contest.startTime, "UTC");
  const description = PREDICTABLE.includes(contest.platform)
    ? `${contest.title} on ${platformLabel} — starts ${when}, runs ${formatDuration(contest.durationSeconds)}. Questions, the full ranking and every rating change.`
    : `${contest.title} on ${platformLabel} — starts ${when}, runs ${formatDuration(contest.durationSeconds)}. Start time in your timezone, duration and calendar reminders.`;
  const canonical = contestPath(contest);

  return {
    title: contest.title,
    description,
    alternates: { canonical },
    openGraph: { title: contest.title, description, url: canonical, type: "website" },
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

export default async function ContestDetailPage({ params }: Props) {
  const { slug } = await params;

  const contest = await getContestByPathParam(slug);
  if (!contest) notFound();

  // Reached by cuid (an old bookmark or shared link) — send search engines and
  // visitors to the one canonical URL rather than serving it under two.
  if (contest.slug && contest.slug !== slug) permanentRedirect(contestPath(contest));

  const color = platformColor(contest.platform);
  const platformLabel = PLATFORM_META[contest.platform].label;
  const nowMs = new Date().getTime();
  const started = nowMs >= contest.startTime.getTime();
  const ended = nowMs >= contest.endTime.getTime();
  const isPredictable = PREDICTABLE.includes(contest.platform);

  // Questions (LeetCode + Codeforces, once the contest has started). Server-
  // rendered; failures degrade to an omitted section. Calls the fetchers
  // directly rather than the rate-limited tRPC procedure — see
  // server/contest/questions.ts for why.
  const questions =
    isPredictable && started
      ? await contestQuestions(contest.platform, contest.externalId)
      : null;

  const canonical = absoluteUrl(contestPath(contest));

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-[22px]">
      {/* A coding contest is a scheduled online Event; the breadcrumb is what
          actually renders in the search result. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Event",
              name: contest.title,
              url: canonical,
              startDate: contest.startTime.toISOString(),
              endDate: contest.endTime.toISOString(),
              eventStatus: "https://schema.org/EventScheduled",
              eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
              location: { "@type": "VirtualLocation", url: contest.url },
              organizer: { "@type": "Organization", name: platformLabel, url: contest.url },
              description: `${contest.title} — a ${platformLabel} competitive programming contest running ${formatDuration(contest.durationSeconds)}.`,
              isAccessibleForFree: true,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                // Two levels only: the platform filter is client-side state,
                // not its own URL, so a per-platform crumb would point at a
                // page that ignores it.
                { "@type": "ListItem", position: 1, name: "Contests", item: absoluteUrl("/contests") },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: ended ? "Past contests" : "Upcoming contests",
                  item: absoluteUrl(ended ? "/contests/past" : "/contests"),
                },
                { "@type": "ListItem", position: 3, name: contest.title, item: canonical },
              ],
            },
          ],
        }}
      />

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
          {ended ? (
          <Link
            href={contestPath(contest, "compare")}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
          >
            <Swords className="size-3.5" /> Compare with friend
          </Link>
          ) : null}
          {isPredictable ? (
            <Link
              href={contestPath(contest, "predict")}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
            >
              <LineChart className="size-3.5" /> Predict my rating
            </Link>
          ) : null}
        </div>
      </header>

      {/* Contest facts — the answer to "when is X and how long is it", present
          for every platform and readable without JavaScript. */}
      <section className="mb-9">
        <SectionHeading
          icon={<CalendarClock className="size-[18px] text-cp-accent" />}
          title="When it runs"
        />
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-cp-line bg-cp-line sm:grid-cols-3">
          {[
            { k: "Starts", v: <LocalDate date={contest.startTime} /> },
            { k: "Ends", v: <LocalDate date={contest.endTime} /> },
            {
              k: "Duration",
              v: (
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5 text-cp-faint" />
                  {formatDuration(contest.durationSeconds)}
                </span>
              ),
            },
          ].map((row) => (
            <div key={row.k} className="bg-cp-surface px-4 py-3">
              <dt className="text-[11px] uppercase tracking-[0.12em] text-cp-faint">{row.k}</dt>
              <dd className="mt-1 text-[14px] text-cp-text">{row.v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13.5px] leading-relaxed text-cp-dim">
          {contest.title} is {contest.difficulty ? `a ${contest.difficulty} ` : "a "}
          contest on {platformLabel}, running for {formatDuration(contest.durationSeconds)}.
          Times above are shown in your local timezone. Bookmark it on the{" "}
          <Link href="/contests" className="text-cp-accent hover:underline">
            contests feed
          </Link>{" "}
          to get an email reminder 24 hours and 1 hour before it starts.
        </p>
      </section>

      {!isPredictable ? (
        <Notice>
          Full rankings and rating changes are available for LeetCode and Codeforces contests today.
          Once this one ends you can still compare your result with a friend.
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
