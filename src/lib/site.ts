/**
 * Canonical site identity for SEO metadata.
 *
 * Deliberately NOT request-derived (unlike `appBaseUrl` in ./base-url, which
 * builds links from the incoming Host so calendar/duel URLs match whatever
 * domain the user is on). Canonical URLs, OG tags and the sitemap must name ONE
 * origin — if they echoed the request host, every preview deployment would
 * publish canonicals pointing at itself and Google would see the same content
 * under a dozen hostnames. Change SITE_URL in one place when a custom domain
 * lands; nothing else needs touching.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://next-contest.vercel.app"
).replace(/\/+$/, "");

/**
 * Only the production deployment may be indexed. Vercel sets VERCEL_ENV to
 * "preview" on branch/PR deploys; locally it is unset, which we treat as
 * indexable so `next build` output can be inspected the way prod renders it.
 */
export const IS_INDEXABLE = process.env.VERCEL_ENV !== "preview" && process.env.VERCEL_ENV !== "development";

/** Absolute URL for a site-relative path (`/contests` -> `https://…/contests`). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
