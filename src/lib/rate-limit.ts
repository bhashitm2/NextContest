// Dependency-free in-memory rate limiter (fixed-window with carry-in, aka
// "sliding window counter"). Scope is per warm serverless instance — a cold
// start resets counters — so this throttles bursts and casual abuse rather
// than providing a hard global guarantee. If that ever matters, swap the store
// for Upstash Redis behind the same checkRateLimit() signature.

type Window = { start: number; count: number; prevCount: number };

const MAX_KEYS = 10_000; // bound memory; evict oldest-inserted beyond this

const store = new Map<string, Window>();

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

/**
 * Record a hit for `key` and report whether it stays within `max` hits per
 * `windowMs`. The previous window's count is weighted in proportionally so the
 * limit can't be doubled by straddling a window boundary.
 */
export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  let w = store.get(key);

  if (!w || now - w.start >= 2 * opts.windowMs) {
    w = { start: now, count: 0, prevCount: 0 };
    store.set(key, w);
  } else if (now - w.start >= opts.windowMs) {
    w.prevCount = w.count;
    w.count = 0;
    w.start += opts.windowMs * Math.floor((now - w.start) / opts.windowMs);
  }

  if (store.size > MAX_KEYS) {
    // Map preserves insertion order; dropping the oldest entries is a cheap
    // approximation of LRU that keeps the store bounded under key churn.
    const excess = store.size - MAX_KEYS;
    let dropped = 0;
    for (const k of store.keys()) {
      store.delete(k);
      if (++dropped >= excess) break;
    }
  }

  const elapsed = (now - w.start) / opts.windowMs;
  const weighted = w.count + w.prevCount * (1 - elapsed);
  if (weighted >= opts.max) {
    return { ok: false, retryAfterMs: Math.max(1000, Math.ceil(opts.windowMs * (1 - elapsed))) };
  }

  w.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFrom(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
