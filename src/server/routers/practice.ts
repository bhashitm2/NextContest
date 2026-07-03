import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { JUDGE_LIMITS } from "@/lib/judge-types";
import { isAdmin } from "@/server/practice/admin";
import { callJudge, JudgeOfflineError } from "@/server/practice/judge-client";
import { createTRPCRouter, protectedProcedure, publicProcedure, rateLimited } from "@/server/trpc";

const languageSchema = z.enum(["PYTHON", "CPP", "JAVA"]);

const sourceSchema = z
  .string()
  .min(1)
  .refine((s) => Buffer.byteLength(s, "utf8") <= JUDGE_LIMITS.maxSourceBytes, {
    message: "Source too large (64KB max)",
  });

/** Trim judge outputs before they travel to the browser. */
const clip = (s: string | undefined, max = 8 * 1024) =>
  s == null ? null : s.length > max ? `${s.slice(0, max)}\n… (truncated)` : s;

const submissionSelect = {
  id: true,
  language: true,
  verdict: true,
  passedCount: true,
  totalCount: true,
  timeMs: true,
  createdAt: true,
} as const;

export const practiceRouter = createTRPCRouter({
  /** Problem catalog. Everyone sees PUBLISHED; the admin also sees DRAFTs
   * (flagged, so the review UI can badge them). */
  list: publicProcedure.query(async ({ ctx }) => {
    const admin = await isAdmin(ctx.db, ctx.userId);
    const [problems, solved] = await Promise.all([
      ctx.db.problem.findMany({
        where: admin ? {} : { status: "PUBLISHED" },
        select: {
          slug: true,
          title: true,
          difficulty: true,
          tags: true,
          status: true,
        },
        orderBy: [{ ord: "asc" }, { difficulty: "asc" }, { createdAt: "asc" }],
      }),
      ctx.userId
        ? ctx.db.judgeSubmission.findMany({
            where: { userId: ctx.userId, verdict: "AC" },
            select: { problem: { select: { slug: true } } },
            distinct: ["problemId"],
          })
        : Promise.resolve([]),
    ]);

    return {
      problems,
      solvedSlugs: solved.map((s) => s.problem.slug),
      isAdmin: admin,
    };
  }),

  /** One problem: statement + sample tests only — hidden tests never leave the
   * server. DRAFTs are visible to the admin only. */
  get: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(80) }))
    .query(async ({ ctx, input }) => {
      const problem = await ctx.db.problem.findUnique({
        where: { slug: input.slug },
        select: {
          slug: true,
          title: true,
          statementMd: true,
          editorialMd: true,
          difficulty: true,
          tags: true,
          timeLimitMs: true,
          memoryMb: true,
          status: true,
          tests: {
            where: { hidden: false },
            orderBy: { ord: "asc" },
            select: { input: true, expected: true },
          },
        },
      });
      const admin = await isAdmin(ctx.db, ctx.userId);
      if (!problem || (problem.status === "DRAFT" && !admin)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such problem" });
      }

      const mySubmissions = ctx.userId
        ? await ctx.db.judgeSubmission.findMany({
            where: { userId: ctx.userId, problem: { slug: input.slug } },
            select: submissionSelect,
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : [];

      return { problem, mySubmissions, isAdmin: admin };
    }),

  /** Run code against the SAMPLE tests only (or one custom input) — instant
   * feedback with actual output and stderr, nothing stored. */
  run: protectedProcedure
    .use(rateLimited("practice.run", 15, 60_000))
    .input(
      z.object({
        slug: z.string().trim().min(1).max(80),
        language: languageSchema,
        source: sourceSchema,
        customInput: z.string().max(64 * 1024).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const problem = await ctx.db.problem.findUnique({
        where: { slug: input.slug },
        select: {
          status: true,
          timeLimitMs: true,
          memoryMb: true,
          tests: {
            where: { hidden: false },
            orderBy: { ord: "asc" },
            select: { input: true, expected: true },
          },
        },
      });
      if (!problem) throw new TRPCError({ code: "NOT_FOUND", message: "No such problem" });
      if (problem.status === "DRAFT" && !(await isAdmin(ctx.db, ctx.userId))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such problem" });
      }

      const custom = input.customInput != null && input.customInput.length > 0;
      const tests = custom
        ? [{ input: input.customInput!, expected: "" }]
        : problem.tests;
      if (tests.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This problem has no sample tests" });
      }

      let judged;
      try {
        judged = await callJudge({
          language: input.language,
          source: input.source,
          tests,
          timeLimitMs: problem.timeLimitMs,
          memoryMb: problem.memoryMb,
          returnOutput: true, // runs every test, returns stdout + stderr
        });
      } catch (e) {
        if (e instanceof JudgeOfflineError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
        }
        throw e;
      }

      return {
        mode: custom ? ("custom" as const) : ("samples" as const),
        compileOutput: clip(judged.compileOutput),
        tests: judged.tests.map((t, i) => ({
          // Custom input has no expected output — a "WA" there just means the
          // run finished; report it as AC so the UI reads "ran fine".
          status: custom && t.status === "WA" ? ("AC" as const) : t.status,
          timeMs: t.timeMs,
          input: clip(tests[i].input, 2 * 1024),
          output: clip(t.output),
          expected: custom ? null : clip(tests[i].expected),
          stderr: clip(t.stderr, 2 * 1024),
        })),
      };
    }),

  /** Judge a submission synchronously (the route sets maxDuration=60; the
   * judge budgets 45s). Judge unreachable → PRECONDITION_FAILED, no row. */
  submit: protectedProcedure
    .use(rateLimited("practice.submit", 6, 60_000))
    .input(
      z.object({
        slug: z.string().trim().min(1).max(80),
        language: languageSchema,
        source: sourceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const problem = await ctx.db.problem.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          status: true,
          timeLimitMs: true,
          memoryMb: true,
          tests: { orderBy: { ord: "asc" }, select: { input: true, expected: true } },
        },
      });
      if (!problem || problem.tests.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such problem" });
      }
      if (problem.status === "DRAFT" && !(await isAdmin(ctx.db, ctx.userId))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such problem" });
      }

      let judged;
      try {
        judged = await callJudge({
          language: input.language,
          source: input.source,
          tests: problem.tests,
          timeLimitMs: problem.timeLimitMs,
          memoryMb: problem.memoryMb,
        });
      } catch (e) {
        if (e instanceof JudgeOfflineError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
        }
        throw e;
      }

      const passedCount = judged.tests.filter((t) => t.status === "AC").length;
      const submission = await ctx.db.judgeSubmission.create({
        data: {
          userId: ctx.userId,
          problemId: problem.id,
          language: input.language,
          source: input.source,
          verdict: judged.verdict,
          passedCount,
          totalCount: problem.tests.length,
          timeMs: judged.verdict === "CE" ? null : judged.timeMs,
          compileOutput: judged.compileOutput ?? null,
        },
        select: submissionSelect,
      });

      return {
        submission,
        verdict: judged.verdict,
        tests: judged.tests.map((t) => ({ status: t.status, timeMs: t.timeMs })),
        compileOutput: judged.compileOutput ?? null,
      };
    }),

  /** Source code of ONE of the viewer's own submissions (Submissions tab). */
  submissionSource: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.judgeSubmission.findUnique({
        where: { id: input.id },
        select: { userId: true, source: true, language: true },
      });
      if (!submission || submission.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { source: submission.source, language: submission.language };
    }),

  /** Publish / unpublish — admin-only; this IS the draft-review mechanism. */
  setStatus: protectedProcedure
    .input(
      z.object({
        slug: z.string().trim().min(1).max(80),
        status: z.enum(["DRAFT", "PUBLISHED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isAdmin(ctx.db, ctx.userId))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const problem = await ctx.db.problem.update({
        where: { slug: input.slug },
        data: { status: input.status },
        select: { slug: true, status: true },
      });
      return problem;
    }),
});
