/**
 * AI problem-authoring core, shared by author-problem.ts (one-off) and
 * author-batch.ts (bank building). The flow that keeps the bank trustworthy:
 *
 *   1. Gemini drafts an ORIGINAL statement + Python reference solution + test
 *      INPUTS only (2-3 literal samples + hidden edge cases). Big stress-test
 *      inputs can't come back as LLM output, so a hidden test may instead be a
 *      tiny deterministic Python GENERATOR whose stdout IS the input — the
 *      judge materializes it in the same sandbox as everything else.
 *   2. The reference solution runs through the real nc-judge (returnOutput
 *      mode) and its stdout BECOMES the expected output for every test — the
 *      reference is the single source of truth, so "wrong expected answer"
 *      can't happen. The reference must also finish in ≤ half the time limit.
 *   3. Failures feed back into Gemini for revision (≤3 attempts).
 *   4. The problem lands as DRAFT; the admin reviews at /practice/<slug> and
 *      publishes from there.
 */
import { prisma } from "../src/lib/db";
import { callJudge } from "../src/server/practice/judge-client";
import { callGeminiJson } from "../src/server/ai/gemini";

export type Archetype = {
  slug: string;
  difficulty: number;
  tags: string[];
  prompt: string;
  timeLimitMs?: number;
  /** Curated position in the /practice list (defaults to 0 = difficulty order). */
  ord?: number;
};

export type DraftTest = { input?: string; generatorPython?: string; sample: boolean };

export type Draft = {
  title: string;
  statementMd: string;
  /** Markdown editorial (approach + complexity) — shown under the Editorial tab. */
  editorialMd?: string;
  referencePython: string;
  tests: DraftTest[];
};

/** Same trailing-whitespace normalization the judge applies when comparing. */
function normalizeOutput(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

const PYTHON_TIME_MULTIPLIER = 3; // keep in sync with judge/src/languages.ts
const MAX_INPUT_BYTES = 200 * 1024; // safety margin under the judge's 256KB cap

function draftPrompt(a: Archetype, revision?: string): string {
  return `You are a competitive-programming problem setter. Create ONE original practice problem.

ARCHETYPE (the algorithmic idea to test): ${a.prompt}
DIFFICULTY: ${a.difficulty} on the Codeforces scale (800 = beginner, 2000 = hard). Constraints and required algorithm must match this difficulty.
TAGS: ${a.tags.join(", ")}

REQUIREMENTS
- Write a completely ORIGINAL statement (fresh story/wording — never name or copy an existing problem). Keep the story short; two sentences of flavor at most.
- The problem is solved via stdin/stdout.
- Statement is GitHub markdown with EXACTLY these sections: a lead paragraph, "## Input", "## Output", "## Constraints". State constraints precisely (bounds on n and values). LaTeX math is supported ($…$ inline, $$…$$ display) and preferred for formulas like $1 \\le n \\le 2 \\cdot 10^4$.
- Size constraints so (a) a straightforward correct PYTHON solution runs well under 2 seconds and (b) the largest legal input stays under 200KB — e.g. n ≤ 2*10^4 numbers. Naive-complexity solutions should still exceed the time limit at max constraints when the archetype has an intended faster algorithm.
- referencePython: a correct, efficient CPython 3.12 solution. Read input ROBUSTLY with data = sys.stdin.read().split() and consume tokens by position — never assume specific line breaks. It MUST solve the problem you stated, including edge cases.
- tests: 8 to 12 tests, INPUTS only (no outputs). Each test is EITHER {"input": "...", "sample": bool} with a literal input of at most 25 short lines, OR {"generatorPython": "...", "sample": false} where generatorPython is a small deterministic CPython script (fixed seed if it uses random) that PRINTS the test input to stdout.
- Generator scripts MUST build the data structure first and derive every count from it — e.g. vals = [...]; print(len(vals)); print(" ".join(map(str, vals))) — NEVER print a hardcoded count that could drift from the data actually generated.
- The first 2-3 tests have "sample": true and MUST be literal, small and illustrative.
- Hidden tests cover: minimum bounds, tricky/degenerate cases (literal), and 1-3 MAXIMUM-bound stress tests (use generatorPython for anything bigger than 25 lines; generated input must respect your stated constraints EXACTLY and stay under 200KB).
- Every input ends with a newline.
- Deterministic output only (a unique correct output per input; no "any valid answer" problems).
- editorialMd: a concise markdown editorial — the intended approach, why it works, and time/space complexity. No code needed; 5-12 sentences.
${revision ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION:\n${revision}\nFix the issue — adjust the solution, the tests, or the constraints so everything is consistent.\n` : ""}
Respond with JSON only:
{"title": string, "statementMd": string, "editorialMd": string, "referencePython": string, "tests": [{"input"?: string, "generatorPython"?: string, "sample": boolean}]}`;
}

function sanity(d: Draft): string | null {
  if (!d.title?.trim() || d.title.length > 80) return "title missing or too long";
  if (!d.statementMd || d.statementMd.length < 200) return "statement too short";
  if (!/## Input/.test(d.statementMd) || !/## Output/.test(d.statementMd)) {
    return "statement missing ## Input / ## Output sections";
  }
  if (!d.referencePython?.trim()) return "referencePython missing";
  if (!Array.isArray(d.tests) || d.tests.length < 8 || d.tests.length > 12) {
    return `need 8-12 tests, got ${d.tests?.length ?? 0}`;
  }
  const samples = d.tests.filter((t) => t.sample).length;
  if (samples < 2 || samples > 3) return `need 2-3 samples, got ${samples}`;
  for (const [i, t] of d.tests.entries()) {
    const hasLiteral = typeof t.input === "string" && t.input.length > 0;
    const hasGen = typeof t.generatorPython === "string" && t.generatorPython.length > 0;
    if (hasLiteral === hasGen) return `test ${i + 1}: need exactly one of input/generatorPython`;
    if (t.sample && !hasLiteral) return `test ${i + 1}: samples must be literal inputs`;
  }
  return null;
}

/** Turn generator tests into literal inputs by running them through the judge. */
async function materialize(
  tests: DraftTest[],
  timeLimitMs: number,
): Promise<{ inputs: string[] } | { error: string }> {
  const inputs: string[] = [];
  for (const [i, t] of tests.entries()) {
    if (t.input != null) {
      inputs.push(t.input);
      continue;
    }
    const run = await callJudge({
      language: "PYTHON",
      source: t.generatorPython!,
      tests: [{ input: "", expected: "" }],
      timeLimitMs,
      memoryMb: 256,
      returnOutput: true,
    });
    const r = run.tests[0];
    if (!r || (r.status !== "WA" && r.status !== "AC")) {
      const trace = r?.stderr?.trim() ? ` — stderr: ${r.stderr.trim().slice(-400)}` : "";
      return { error: `generator for test ${i + 1} failed: ${r?.status ?? "no result"}${trace}` };
    }
    const input = r.output ?? "";
    if (input.trim().length === 0) return { error: `generator for test ${i + 1} printed nothing` };
    if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
      return { error: `generator for test ${i + 1} produced >200KB of input — shrink the constraints` };
    }
    inputs.push(input.endsWith("\n") ? input : `${input}\n`);
  }
  return { inputs };
}

/**
 * Validate ONE ready-made draft (Gemini's or hand-written) and save it as
 * DRAFT: sanity-check the shape, materialize generator tests, run the
 * reference solution through the real judge, adopt its outputs as `expected`.
 */
export async function authorFromDraft(
  a: Archetype,
  draft: Draft,
  { force = false, log = console.log }: { force?: boolean; log?: (msg: string) => void } = {},
): Promise<{ ok: true; slug: string } | { ok: false; error: string; fatal?: boolean }> {
  const timeLimitMs = a.timeLimitMs ?? 2000;

  const existing = await prisma.problem.findUnique({ where: { slug: a.slug }, select: { id: true } });
  if (existing && !force) {
    return { ok: false, error: `slug "${a.slug}" already exists (use --force)`, fatal: true };
  }

  const shapeError = sanity(draft);
  if (shapeError) {
    log(`[${a.slug}] sanity failed: ${shapeError}`);
    return { ok: false, error: shapeError };
  }

  // Materialize generator tests into literal inputs via the sandbox.
  const generators = draft.tests.filter((t) => t.generatorPython).length;
  if (generators > 0) log(`[${a.slug}] materializing ${generators} generated test(s)…`);
  const mat = await materialize(draft.tests, timeLimitMs);
  if ("error" in mat) {
    log(`[${a.slug}] ${mat.error}`);
    return { ok: false, error: mat.error };
  }

  // Reference generates the expected outputs through the real judge.
  log(`[${a.slug}] running reference through the judge (${draft.tests.length} tests)…`);
  let judged;
  try {
    judged = await callJudge({
      language: "PYTHON",
      source: draft.referencePython,
      tests: mat.inputs.map((input) => ({ input, expected: "" })),
      timeLimitMs,
      memoryMb: 256,
      returnOutput: true,
    });
  } catch (e) {
    return { ok: false, error: `judge unreachable: ${e instanceof Error ? e.message : e}`, fatal: true };
  }

  const problems: string[] = [];
  const budget = (timeLimitMs * PYTHON_TIME_MULTIPLIER) / 2;
  judged.tests.forEach((t, i) => {
    // expected="" so a working reference reads WA; real failures are TLE/RE/MLE/SKIPPED.
    if (t.status !== "WA" && t.status !== "AC") {
      const trace = t.stderr?.trim() ? ` — stderr: ${t.stderr.trim().slice(-400)}` : "";
      const head = ` — input starts: ${JSON.stringify(mat.inputs[i].slice(0, 200))}`;
      problems.push(`test ${i + 1}: ${t.status}${trace}${head}`);
    } else if (!t.output || normalizeOutput(t.output).length === 0) {
      problems.push(`test ${i + 1}: empty output`);
    } else if (t.timeMs > budget) {
      problems.push(`test ${i + 1}: too slow (${t.timeMs}ms > ${budget}ms budget)`);
    }
  });
  if (problems.length > 0) {
    log(`[${a.slug}] reference validation failed: ${problems.join("; ")}`);
    return {
      ok: false,
      error: `the reference solution failed on its own tests: ${problems.join("; ")}. TLE/RE mean the solution or constraints are wrong; "too slow" means tighten constraints or speed up the solution.`,
    };
  }

  // All good — store as DRAFT with reference-generated expected outputs.
  if (existing) await prisma.problem.delete({ where: { slug: a.slug } });
  await prisma.problem.create({
    data: {
      slug: a.slug,
      title: draft.title.trim(),
      statementMd: draft.statementMd.trim(),
      editorialMd: draft.editorialMd?.trim() || null,
      difficulty: a.difficulty,
      tags: a.tags,
      timeLimitMs,
      ord: a.ord ?? 0,
      status: "DRAFT",
      tests: {
        create: draft.tests.map((t, i) => ({
          ord: i,
          input: mat.inputs[i],
          expected: normalizeOutput(judged.tests[i].output ?? ""),
          hidden: !t.sample,
        })),
      },
    },
  });
  log(`[${a.slug}] ✔ saved as DRAFT — review at /practice/${a.slug}`);
  return { ok: true, slug: a.slug };
}

export async function authorProblem(
  a: Archetype,
  { force = false, log = console.log }: { force?: boolean; log?: (msg: string) => void } = {},
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  let revision: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`[${a.slug}] drafting (attempt ${attempt}/3)…`);
    const draft = await callGeminiJson<Draft>(draftPrompt(a, revision), {
      temperature: 0.7,
      maxOutputTokens: 16384,
      thinkingBudget: 4096, // authoring benefits from reasoning, unlike the hype-line use
      timeoutMs: 120_000,
      retry429: 3, // free-tier per-minute quota — batch caller just waits
    });
    if (!draft) {
      log(`[${a.slug}] model returned no/invalid JSON — backing off 30s`);
      revision =
        "the model returned no or invalid JSON — respond with COMPACT valid JSON; use generatorPython instead of huge literal inputs";
      await new Promise((r) => setTimeout(r, 30_000)); // free-tier rate-limit relief
      continue;
    }

    const result = await authorFromDraft(a, draft, { force, log });
    if (result.ok) return result;
    if (result.fatal) return { ok: false, error: result.error };
    revision = result.error;
  }

  return { ok: false, error: `gave up after 3 attempts (last issue: ${revision})` };
}
