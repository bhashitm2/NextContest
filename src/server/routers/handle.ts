import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  CE_LANGUAGE_HINT,
  CE_SNIPPET,
  fetchStats,
  fetchVerificationField,
  findCompileError,
  pickChallenge,
  PROFILE_PLATFORM_VALUES,
  type ProfilePlatform,
  statsToHandleData,
  supportsSubmissionVerify,
  validateHandle,
  VERIFICATION_FIELD,
} from "@/server/profile-sync";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc";
import { normalizeUsername, validateUsername } from "@/lib/username";

const platformInput = z.enum(PROFILE_PLATFORM_VALUES);

/** Re-fetch stats at most once per this window via the manual Refresh button. */
const REFRESH_THROTTLE_MS = 60 * 1000;

/** UI countdown for the compile-error challenge (purely cosmetic). */
const CHALLENGE_WINDOW_MS = 3 * 60 * 1000;
/** A challenge older than this is considered stale; user must restart. */
const CHALLENGE_MAX_AGE_MS = 15 * 60 * 1000;

/** Public, non-sensitive columns of a handle. */
const PUBLIC_HANDLE_SELECT = {
  platform: true,
  handle: true,
  rating: true,
  maxRating: true,
  rank: true,
  problemsSolved: true,
  stats: true,
  lastSynced: true,
} as const;

/** A short, user-pasteable verification token, e.g. "nextcontest-a1b2c3". */
function newVerificationCode(): string {
  return `nextcontest-${randomBytes(4).toString("hex")}`;
}

/** Map a thrown fetch/validate error to a clean client-facing message. */
function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const handleRouter = createTRPCRouter({
  /** The current user's connected handles (with stats). */
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.platformHandle.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "asc" },
    }),
  ),

  /** The current user's public username (null until chosen). */
  myUsername: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { username: true },
    });
    return { username: user?.username ?? null };
  }),

  /** Connect a handle: validate it exists, then mint a verification code. */
  add: protectedProcedure
    .input(z.object({ platform: platformInput, handle: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const platform = input.platform as ProfilePlatform;

      const existing = await ctx.db.platformHandle.findUnique({
        where: { userId_platform: { userId: ctx.userId, platform } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You've already connected a handle for this platform.",
        });
      }

      let canonical: string;
      try {
        canonical = await validateHandle(platform, input.handle);
      } catch (err) {
        badRequest(err instanceof Error ? err.message : "Could not find that handle.");
      }

      const code = newVerificationCode();
      await ctx.db.platformHandle.create({
        data: { userId: ctx.userId, platform, handle: canonical, verificationCode: code },
      });
      return { handle: canonical, verificationCode: code, field: VERIFICATION_FIELD[platform] };
    }),

  /** Confirm ownership: scan the platform profile field for the token. */
  verify: protectedProcedure
    .input(z.object({ platform: platformInput }))
    .mutation(async ({ ctx, input }) => {
      const platform = input.platform as ProfilePlatform;
      const row = await ctx.db.platformHandle.findUnique({
        where: { userId_platform: { userId: ctx.userId, platform } },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Handle not connected." });
      if (row.verified) return row;
      if (!row.verificationCode) badRequest("No verification code on file. Re-add the handle.");

      let field: string;
      try {
        field = await fetchVerificationField(platform, row.handle);
      } catch (err) {
        badRequest(err instanceof Error ? err.message : "Could not read your profile.");
      }
      if (!field.includes(row.verificationCode!)) {
        badRequest(
          `Couldn't find ${row.verificationCode} in your ${VERIFICATION_FIELD[platform]} yet. Save it on the platform, then try again.`,
        );
      }

      // Verified. Clear the code, then best-effort load stats (don't block verify on a stats hiccup).
      await ctx.db.platformHandle.update({
        where: { id: row.id },
        data: { verified: true, verificationCode: null },
      });
      try {
        const stats = await fetchStats(platform, row.handle);
        return await ctx.db.platformHandle.update({
          where: { id: row.id },
          data: statsToHandleData(stats),
        });
      } catch {
        return ctx.db.platformHandle.findUnique({ where: { id: row.id } });
      }
    }),

  /** Start a compile-error challenge: pin a random problem + record the time. */
  startSubmissionChallenge: protectedProcedure
    .input(z.object({ platform: platformInput }))
    .mutation(async ({ ctx, input }) => {
      const platform = input.platform as ProfilePlatform;
      if (!supportsSubmissionVerify(platform)) {
        badRequest("Compile-error verification isn't available for this platform.");
      }
      const row = await ctx.db.platformHandle.findUnique({
        where: { userId_platform: { userId: ctx.userId, platform } },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Handle not connected." });
      if (row.verified) badRequest("This handle is already verified.");

      const challenge = await pickChallenge(platform);
      await ctx.db.platformHandle.update({
        where: { id: row.id },
        data: { verifyProblem: challenge.key, verifyStartedAt: new Date() },
      });
      return {
        name: challenge.name,
        submitUrl: challenge.submitUrl,
        snippet: CE_SNIPPET,
        languageHint: CE_LANGUAGE_HINT,
        windowMs: CHALLENGE_WINDOW_MS,
      };
    }),

  /** Confirm ownership by detecting a fresh compile-error submission. */
  verifySubmission: protectedProcedure
    .input(z.object({ platform: platformInput }))
    .mutation(async ({ ctx, input }) => {
      const platform = input.platform as ProfilePlatform;
      const row = await ctx.db.platformHandle.findUnique({
        where: { userId_platform: { userId: ctx.userId, platform } },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Handle not connected." });
      if (row.verified) return row;
      if (!row.verifyProblem || !row.verifyStartedAt) {
        badRequest("Start the challenge first.");
      }
      if (Date.now() - row.verifyStartedAt.getTime() > CHALLENGE_MAX_AGE_MS) {
        badRequest("This challenge expired — start a new one.");
      }

      const sinceSec = Math.floor(row.verifyStartedAt.getTime() / 1000) - 5;
      let found = false;
      try {
        found = await findCompileError(platform, row.handle, row.verifyProblem, sinceSec);
      } catch {
        badRequest("Couldn't reach the judge — try again in a moment.");
      }
      if (!found) {
        badRequest(
          "No compile-error submission found yet — submit one to the pinned problem, then check again. (AtCoder can take a minute to sync.)",
        );
      }

      await ctx.db.platformHandle.update({
        where: { id: row.id },
        data: { verified: true, verifyProblem: null, verifyStartedAt: null, verificationCode: null },
      });
      try {
        const stats = await fetchStats(platform, row.handle);
        return await ctx.db.platformHandle.update({
          where: { id: row.id },
          data: statsToHandleData(stats),
        });
      } catch {
        return ctx.db.platformHandle.findUnique({ where: { id: row.id } });
      }
    }),

  /** Manually re-fetch stats for a verified handle (throttled). */
  refresh: protectedProcedure
    .input(z.object({ platform: platformInput }))
    .mutation(async ({ ctx, input }) => {
      const platform = input.platform as ProfilePlatform;
      const row = await ctx.db.platformHandle.findUnique({
        where: { userId_platform: { userId: ctx.userId, platform } },
      });
      if (!row?.verified) badRequest("Verify this handle before refreshing.");
      if (row!.lastSynced && Date.now() - row!.lastSynced.getTime() < REFRESH_THROTTLE_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Stats were just refreshed — try again in a few minutes.",
        });
      }

      let stats;
      try {
        stats = await fetchStats(platform, row!.handle);
      } catch (err) {
        badRequest(err instanceof Error ? err.message : "Could not refresh stats.");
      }
      return ctx.db.platformHandle.update({
        where: { id: row!.id },
        data: statsToHandleData(stats),
      });
    }),

  /** Disconnect a handle. */
  remove: protectedProcedure
    .input(z.object({ platform: platformInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.platformHandle.deleteMany({
        where: { userId: ctx.userId, platform: input.platform },
      });
      return { ok: true };
    }),

  /** Claim / change the public profile username. */
  setUsername: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const error = validateUsername(input.username);
      if (error) badRequest(error);
      const username = normalizeUsername(input.username);

      const taken = await ctx.db.user.findUnique({ where: { username }, select: { id: true } });
      if (taken && taken.id !== ctx.userId) {
        throw new TRPCError({ code: "CONFLICT", message: "That username is taken." });
      }

      await ctx.db.user.update({ where: { id: ctx.userId }, data: { username } });
      return { username };
    }),

  /** Public profile by username — only verified handles, no sensitive fields. */
  publicProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const username = normalizeUsername(input.username);
      const user = await ctx.db.user.findUnique({
        where: { username },
        select: {
          name: true,
          image: true,
          username: true,
          handles: {
            where: { verified: true },
            select: PUBLIC_HANDLE_SELECT,
            orderBy: { problemsSolved: "desc" },
          },
        },
      });
      return user;
    }),
});
