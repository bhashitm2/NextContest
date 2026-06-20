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

function isAllowed(host: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
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
  if (target.protocol !== "https:" || !isAllowed(target.hostname)) {
    return new Response("host not allowed", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "image/*", "User-Agent": "NextContest-avatar-proxy" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
  if (!upstream.ok) return new Response("upstream error", { status: 502 });

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
