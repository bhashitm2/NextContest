// Same-origin avatar proxy. WebGL textures (the boxing-intro fighter badges)
// require CORS-enabled images; OAuth avatar CDNs don't reliably send CORS
// headers, so loading them cross-origin fails. Fetching them here and re-serving
// from our own origin sidesteps CORS entirely. Host-allowlisted to prevent SSRF.

export const runtime = "nodejs";

const ALLOWED_HOST_SUFFIXES = [
  ".githubusercontent.com",
  ".googleusercontent.com",
  ".gravatar.com",
];

const MAX_BYTES = 5 * 1024 * 1024; // cap proxied images at 5 MB

function isAllowed(host: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

function allowedHttps(u: URL): boolean {
  return u.protocol === "https:" && isAllowed(u.hostname);
}

/** Fetch following redirects MANUALLY, re-validating every hop's host against the
 * allowlist — so an allowlisted CDN can't redirect us to an internal/untrusted
 * host (SSRF defense). Returns the final non-redirect response, or null. */
async function fetchValidated(start: URL): Promise<Response | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      headers: { Accept: "image/*", "User-Agent": "NextContest-avatar-proxy" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      let next: URL;
      try {
        next = new URL(loc, url); // resolve relative redirects
      } catch {
        return null;
      }
      if (!allowedHttps(next)) return null;
      url = next;
      continue;
    }
    return res;
  }
  return null; // too many redirects
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (!allowedHttps(target)) {
    return new Response("host not allowed", { status: 400 });
  }

  let upstream: Response | null;
  try {
    upstream = await fetchValidated(target);
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
  if (!upstream || !upstream.ok) return new Response("upstream error", { status: 502 });

  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) return new Response("too large", { status: 413 });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("not an image", { status: 400 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
