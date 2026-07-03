import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { outputsMatch } from "./compare.js";
import { LANGUAGES } from "./languages.js";
import { dockerRun, type RunResult } from "./sandbox.js";
import type { JudgeRequest, JudgeResponse, TestResult, TestStatus, Verdict } from "./types.js";

/** Global per-submission budget: the Vercel caller has 60s, keep well under. */
const GLOBAL_BUDGET_MS = 45_000;
/** Extra wall grace over the (multiplied) limit before we call it TLE. */
const WALL_GRACE_MS = 200;
const COMPILE_OUTPUT_CAP = 8 * 1024;

const WORK_BASE = process.env.WORK_DIR || tmpdir();

function statusOf(r: RunResult, effectiveLimitMs: number): Exclude<TestStatus, "SKIPPED"> {
  if (r.killedByUs || r.wallMs >= effectiveLimitMs) return "TLE";
  if (r.exitCode === 137) return "MLE"; // container OOM-kill
  if (r.exitCode !== 0) return "RE";
  return "AC"; // provisional — caller compares output next
}

/** Judge one submission: compile once (if needed), run each test in its own
 * sandbox container, compare outputs, aggregate the verdict. */
export async function judgeSubmission(req: JudgeRequest): Promise<JudgeResponse> {
  const lang = LANGUAGES[req.language];
  const work = await mkdtemp(join(WORK_BASE, "ncj-"));
  // The sandbox runs as `nobody`; the compile step must write into the mount.
  await chmod(work, 0o777).catch(() => {});

  try {
    await writeFile(join(work, lang.sourceFile), req.source, "utf8");

    if (lang.compileArgv) {
      const c = await dockerRun({
        image: lang.image,
        argv: lang.compileArgv,
        workDir: work,
        writable: true,
        stdin: "",
        memoryMb: 512,
        timeoutMs: lang.compileTimeoutMs,
      });
      if (c.exitCode !== 0) {
        return {
          verdict: "CE",
          compileOutput: (c.stderr || c.stdout || "compilation failed").slice(0, COMPILE_OUTPUT_CAP),
          tests: req.tests.map(() => ({ status: "SKIPPED" as const, timeMs: 0 })),
          timeMs: 0,
        };
      }
    }

    const effectiveLimitMs = req.timeLimitMs * lang.timeMultiplier;
    const deadline = Date.now() + GLOBAL_BUDGET_MS;
    const results: TestResult[] = [];
    let failed: Exclude<TestStatus, "SKIPPED"> | null = null;
    let maxTimeMs = 0;

    // Authoring mode runs the reference solution to GENERATE expected outputs
    // (expected is empty, so statuses read WA) — never early-exit there.
    const earlyExit = !req.returnOutput;
    for (const test of req.tests) {
      if ((earlyExit && failed) || Date.now() > deadline) {
        results.push({ status: "SKIPPED", timeMs: 0 });
        continue;
      }
      const r = await dockerRun({
        image: lang.image,
        argv: lang.runArgv(req.memoryMb),
        workDir: work,
        writable: false,
        stdin: test.input,
        memoryMb: req.memoryMb + lang.memoryOverheadMb,
        timeoutMs: effectiveLimitMs + WALL_GRACE_MS,
      });

      let status = statusOf(r, effectiveLimitMs);
      if (status === "AC" && !outputsMatch(r.stdout, test.expected)) status = "WA";
      if (r.outputCapped) status = "RE";

      results.push({
        status,
        timeMs: r.wallMs,
        // Output cap matches maxInputBytes: authoring materializes generator
        // stdout into test INPUTS, so a lower cap would truncate them mid-token.
        ...(req.returnOutput
          ? { output: r.stdout.slice(0, 256 * 1024), stderr: r.stderr.slice(0, 8 * 1024) }
          : {}),
      });
      if (status === "AC") maxTimeMs = Math.max(maxTimeMs, r.wallMs);
      else failed = status;
    }

    const verdict: Verdict =
      failed ?? (results.every((t) => t.status === "AC") ? "AC" : "JUDGE_ERROR");
    return { verdict, tests: results, timeMs: maxTimeMs };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
