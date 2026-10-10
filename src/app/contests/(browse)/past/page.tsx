import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { auth } from "@/auth";
import { PastContestsFeed } from "@/components/contest/past-contests-feed";
import { JsonLd } from "@/components/json-ld";
import { contestPath } from "@/lib/contest-slug";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

/** Contests are kept permanently, so the archive is paged — otherwise only the
 * most recent page would have any internal link pointing at it, and older
 * contest pages would decay out of the index. */
const PER_PAGE = 60;

type Props = { searchParams: Promise<{ page?: string }> };

function pageNumber(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function pageHref(page: number): string {
  return page <= 1 ? "/contests/past" : `/contests/past?page=${page}`;
}

/** Shared by generateMetadata and the page body (one query per request). */
const finishedCount = cache(async () =>
  prisma.contest.count({ where: { endTime: { lt: new Date() } } }),
);

/**
 * Out-of-range pages are CLAMPED to the last page rather than 404'd.
 *
 * This route lives under the (browse) route group, whose loading.tsx opens a
 * Suspense boundary — so the response has already started streaming with a 200
 * by the time the page body runs, and a notFound() here cannot change the
 * status. It just renders an empty slot: a blank page for the visitor and a
 * soft 404 for Google. Clamping keeps the page useful, and the canonical below
 * points at the real page so nothing duplicate gets indexed.
 */
async function resolvePage(raw: string | undefined) {
  const total = await finishedCount();
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const requested = pageNumber(raw);
  return { page: Math.min(requested, lastPage), requested, lastPage, total };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page, requested } = await resolvePage((await searchParams).page);
  return {
    title: page > 1 ? `Past Contests — page ${page}` : "Past Contests",
    description:
      "Archive of finished contests across Codeforces, LeetCode, AtCoder and CodeChef — rankings, rating changes, and head-to-head comparison with a friend.",
    // Each page is its own canonical; page 2+ would otherwise be treated as a
    // duplicate of page 1 and dropped, taking its links with it. An
    // out-of-range ?page= canonicals to the page it actually shows.
    alternates: { canonical: pageHref(page) },
    // Don't let a made-up page number into the index at all.
    robots: requested > page ? { index: false, follow: true } : undefined,
  };
}

export default async function PastContestsPage({ searchParams }: Props) {
  const { page, lastPage, total } = await resolvePage((await searchParams).page);
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });

  const { items: contests } = await caller.contest.finished({
    limit: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <div className="animate-tab-in">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Past coding contests",
          numberOfItems: contests.length,
          itemListElement: contests.slice(0, 30).map((c, i) => ({
            "@type": "ListItem",
            position: (page - 1) * PER_PAGE + i + 1,
            name: c.title,
            url: absoluteUrl(contestPath(c)),
          })),
        }}
      />

      {contests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cp-line-strong py-20 text-center text-cp-dim">
          No finished contests yet — check back after the next round wraps up.
        </div>
      ) : (
        <>
          <PastContestsFeed contests={contests} />
          <Pager page={page} lastPage={lastPage} total={total} />
        </>
      )}
    </div>
  );
}

/** Real <a> links, so a crawler can walk the whole archive. */
function Pager({ page, lastPage, total }: { page: number; lastPage: number; total: number }) {
  if (lastPage <= 1) return null;

  const around = [page - 1, page, page + 1].filter((n) => n >= 1 && n <= lastPage);
  const numbers = [...new Set([1, ...around, lastPage])].sort((a, b) => a - b);

  return (
    <nav aria-label="Past contests pages" className="mt-8 flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 ? (
          <Link
            href={pageHref(page - 1)}
            rel="prev"
            className="rounded-[9px] border border-cp-line-strong bg-cp-surface px-3 py-1.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
          >
            ← Newer
          </Link>
        ) : null}

        {numbers.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - numbers[i - 1]! > 1 ? (
              <span className="px-1 text-cp-faint">…</span>
            ) : null}
            <Link
              href={pageHref(n)}
              aria-current={n === page ? "page" : undefined}
              className={`rounded-[9px] border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                n === page
                  ? "border-cp-accent bg-cp-accent text-cp-accent-ink"
                  : "border-cp-line-strong bg-cp-surface text-cp-text hover:border-cp-accent"
              }`}
            >
              {n}
            </Link>
          </span>
        ))}

        {page < lastPage ? (
          <Link
            href={pageHref(page + 1)}
            rel="next"
            className="rounded-[9px] border border-cp-line-strong bg-cp-surface px-3 py-1.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
          >
            Older →
          </Link>
        ) : null}
      </div>
      <p className="font-mono text-xs text-cp-faint">
        Page {page} of {lastPage} · {total} finished contests
      </p>
    </nav>
  );
}
