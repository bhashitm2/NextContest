import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { QueueFullError, Semaphore } from "./queue.js";
import { judgeSubmission } from "./runner.js";
import { type JudgeRequest, LIMITS } from "./types.js";

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.JUDGE_SECRET;
if (!SECRET) {
  console.error("JUDGE_SECRET is required");
  process.exit(1);
}

// Concurrent judgings — match the VM's OCPU count (each sandbox gets 1 CPU;
// oversubscribing a small VM inflates wall times into false TLEs).
const CONCURRENCY = Math.max(1, Number(process.env.JUDGE_CONCURRENCY) || 2);
const queue = new Semaphore(CONCURRENCY, 10);

/** Parse + bounds-check the request body; returns null when invalid. */
function validate(body: unknown): JudgeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.language !== "PYTHON" && b.language !== "CPP" && b.language !== "JAVA") return null;
  if (typeof b.source !== "string" || b.source.length === 0) return null;
  if (Buffer.byteLength(b.source) > LIMITS.maxSourceBytes) return null;
  if (!Array.isArray(b.tests) || b.tests.length === 0 || b.tests.length > LIMITS.maxTests) return null;
  for (const t of b.tests) {
    if (typeof t?.input !== "string" || typeof t?.expected !== "string") return null;
    if (Buffer.byteLength(t.input) > LIMITS.maxInputBytes) return null;
  }
  const timeLimitMs = Number(b.timeLimitMs);
  const memoryMb = Number(b.memoryMb);
  if (
    !Number.isFinite(timeLimitMs) ||
    timeLimitMs < LIMITS.minTimeLimitMs ||
    timeLimitMs > LIMITS.maxTimeLimitMs
  ) {
    return null;
  }
  if (!Number.isFinite(memoryMb) || memoryMb < LIMITS.minMemoryMb || memoryMb > LIMITS.maxMemoryMb) {
    return null;
  }
  return {
    language: b.language,
    source: b.source,
    tests: (b.tests as { input: string; expected: string }[]).map((t) => ({
      input: t.input,
      expected: t.expected,
    })),
    timeLimitMs,
    memoryMb,
    returnOutput: b.returnOutput === true,
  };
}

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, ...queue.stats }));

app.post("/judge", async (c) => {
  if (c.req.header("authorization") !== `Bearer ${SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 422);
  }
  const req = validate(body);
  if (!req) return c.json({ error: "invalid payload" }, 422);

  try {
    const started = Date.now();
    const res = await queue.run(() => judgeSubmission(req));
    console.log(
      `judged lang=${req.language} tests=${req.tests.length} verdict=${res.verdict} in ${Date.now() - started}ms`,
    );
    return c.json(res);
  } catch (e) {
    if (e instanceof QueueFullError) return c.json({ error: "queue full" }, 429);
    console.error("judge error:", e);
    return c.json(
      { verdict: "JUDGE_ERROR", tests: [], timeMs: 0 },
      200, // reachable-but-failed is a judged outcome, not a transport error
    );
  }
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`nc-judge listening on :${PORT}`);
});
