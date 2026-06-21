/** Route an external avatar URL through our same-origin proxy (`/api/avatar`).
 * OAuth avatar CDNs (githubusercontent / googleusercontent) often reject direct
 * browser hotlinks; the proxy fetches server-side and re-serves with caching.
 * Returns null for a null input so callers can fall back to an initial. */
export function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/avatar?u=${encodeURIComponent(url)}`;
}
