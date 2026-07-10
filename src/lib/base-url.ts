/** Build the site's base URL from the actual request, so generated links
 * always match the domain the user is on (Vercel, localhost, custom domain)
 * without depending on a NEXT_PUBLIC_APP_URL env var being set correctly. */
export function appBaseUrl(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto =
      headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
