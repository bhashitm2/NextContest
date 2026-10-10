import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

// sitemap.ts is a Route Handler that Next caches at build time unless a
// request-time API or dynamic config says otherwise — a Prisma query is
// neither, so without this the deployed sitemap would freeze at the contest
// list that existed when the build ran.
export const revalidate = 3600;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
  { url: absoluteUrl("/contests"), changeFrequency: "hourly", priority: 0.9 },
  { url: absoluteUrl("/contests/past"), changeFrequency: "daily", priority: 0.6 },
  { url: absoluteUrl("/practice"), changeFrequency: "weekly", priority: 0.8 },
  { url: absoluteUrl("/ratings"), changeFrequency: "weekly", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [contests, problems, profiles] = await Promise.all([
    // Only slugged contests: a cuid URL would be indexed and then 308'd away.
    prisma.contest.findMany({
      where: { slug: { not: null } },
      select: { slug: true, updatedAt: true, startTime: true, endTime: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.problem.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, createdAt: true },
    }),
    // Only profiles with a verified handle carry real content; the rest are
    // empty shells and are noindex'd on the page itself (see u/[username]).
    prisma.user.findMany({
      where: { username: { not: null }, handles: { some: { verified: true } } },
      select: { username: true, handles: { select: { lastSynced: true } } },
    }),
  ]);

  const now = Date.now();

  return [
    ...STATIC_ROUTES.map((r) => ({ ...r, lastModified: new Date() })),
    ...contests.map((c) => {
      // An upcoming contest's page changes daily (countdown, field); a finished
      // one is a stable archive page.
      const upcoming = c.endTime.getTime() >= now;
      return {
        url: absoluteUrl(`/contests/${c.slug}`),
        lastModified: c.updatedAt,
        changeFrequency: (upcoming ? "daily" : "monthly") as "daily" | "monthly",
        priority: upcoming ? 0.8 : 0.5,
      };
    }),
    ...problems.map((p) => ({
      url: absoluteUrl(`/practice/${p.slug}`),
      lastModified: p.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...profiles.map((u) => ({
      url: absoluteUrl(`/u/${u.username}`),
      lastModified: u.handles.reduce<Date | undefined>(
        (latest, h) => (h.lastSynced && (!latest || h.lastSynced > latest) ? h.lastSynced : latest),
        undefined,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
