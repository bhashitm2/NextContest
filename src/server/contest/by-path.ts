import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * Resolve the `/contests/<param>` route segment to a contest.
 *
 * Tries the slug first — that is the canonical form and the hot path — then
 * falls back to the cuid so links minted before slugs existed (bookmarks,
 * shared URLs, old emails) keep working. The page 308s a cuid hit to the slug
 * URL so only one form is ever indexed.
 *
 * No id/slug discrimination is needed: slugs always contain a "-", cuids never
 * do, so the slug lookup simply misses for a cuid.
 *
 * `cache` memoizes per request, so generateMetadata and the page body share one
 * query instead of hitting the DB twice for the same row.
 */
export const getContestByPathParam = cache(async (param: string) => {
  return (
    (await prisma.contest.findUnique({ where: { slug: param } })) ??
    (await prisma.contest.findUnique({ where: { id: param } }))
  );
});
