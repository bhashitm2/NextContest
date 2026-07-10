import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { appBaseUrl } from "@/lib/base-url";
import {
  DUEL_PRESETS,
  INVITE_TTL_MS,
  joinUrlFor,
  RATING_MAX,
  RATING_MIN,
  winTargetFor,
} from "@/lib/duel";
import { normalizeUsername } from "@/lib/username";
import { checkDuel, parseProblems, scoreOf } from "@/server/duel/judge";
import { selectDuelProblems } from "@/server/duel/select-problems";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimited,
} from "@/server/trpc";

const profileSelect = { id: true, username: true, name: true, image: true } as const;

/** Both players' public profiles for a duel row (client picks the counterpart). */
const duelInclude = {
  challenger: { select: profileSelect },
  opponent: { select: profileSelect },
} as const;

const ratingStep = z.number().int().multipleOf(100).min(RATING_MIN).max(RATING_MAX);

export const duelRouter = createTRPCRouter({
  /** Friends who can be challenged: verified Codeforces handle on both sides.
   * Includes ratings so the form can suggest a sensible band. */
  eligibleOpponents: protectedProcedure.query(async ({ ctx }) => {
    const handleFilter = {
      where: { platform: "CODEFORCES" as const, verified: true },
      select: { handle: true, rating: true },
    };
    const [mine, edges] = await Promise.all([
      ctx.db.platformHandle.findFirst({
        where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
        select: { handle: true, rating: true },
      }),
      ctx.db.friendship.findMany({
        where: { status: "ACCEPTED", OR: [{ requesterId: ctx.userId }, { addresseeId: ctx.userId }] },
        include: {
          requester: { select: { ...profileSelect, handles: handleFilter } },
          addressee: { select: { ...profileSelect, handles: handleFilter } },
        },
        orderBy: { respondedAt: "desc" },
      }),
    ]);

    const friends = edges
      .map((e) => (e.requesterId === ctx.userId ? e.addressee : e.requester))
      .filter((f) => f.username && f.handles.length > 0)
      .map((f) => ({
        username: f.username!,
        name: f.name,
        image: f.image,
        handle: f.handles[0].handle,
        rating: f.handles[0].rating,
      }));

    return { me: mine, friends };
  }),

  /** Send a duel invite. Config is derived server-side from format + preset. */
  create: protectedProcedure
    .use(rateLimited("duel.create", 10, 60_000))
    .input(
      z
        .object({
          username: z.string().trim().min(1).max(40),
          format: z.enum(["TIMED", "FIRST_SOLVE", "RACE"]),
          preset: z.enum(["QUICK", "STANDARD", "MARATHON"]),
          ratingMin: ratingStep,
          ratingMax: ratingStep,
        })
        .refine((v) => v.ratingMax >= v.ratingMin, {
          message: "Max rating must be at least the min rating",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = normalizeUsername(input.username);
      const target = await ctx.db.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!target || target.id === ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such friend" });
      }

      const [friendship, myHandle, theirHandle, existing] = await Promise.all([
        ctx.db.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: ctx.userId, addresseeId: target.id },
              { requesterId: target.id, addresseeId: ctx.userId },
            ],
          },
          select: { id: true },
        }),
        ctx.db.platformHandle.findFirst({
          where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
          select: { id: true },
        }),
        ctx.db.platformHandle.findFirst({
          where: { userId: target.id, platform: "CODEFORCES", verified: true },
          select: { id: true },
        }),
        ctx.db.duel.findFirst({
          where: {
            status: { in: ["PENDING", "ACTIVE"] },
            OR: [
              { challengerId: ctx.userId, opponentId: target.id },
              { challengerId: target.id, opponentId: ctx.userId },
            ],
          },
          select: { id: true },
        }),
      ]);

      if (!friendship) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only duel friends" });
      }
      if (!myHandle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Verify your Codeforces handle first (Settings → Profile Links)",
        });
      }
      if (!theirHandle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Your friend has no verified Codeforces handle",
        });
      }
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "There's already a pending or active duel with this friend",
        });
      }

      const preset = DUEL_PRESETS[input.preset];
      return ctx.db.duel.create({
        data: {
          challengerId: ctx.userId,
          opponentId: target.id,
          format: input.format,
          problemCount: preset.problemCount,
          durationSec: preset.durationSec,
          winTarget: winTargetFor(input.format, preset.problemCount),
          ratingMin: input.ratingMin,
          ratingMax: input.ratingMax,
        },
        include: duelInclude,
      });
    }),

  /** Create an OPEN duel — no opponent yet; anyone with the link can claim it.
   * Single-use, same 24h TTL as friend invites. */
  createOpen: protectedProcedure
    .use(rateLimited("duel.createOpen", 5, 60_000))
    .input(
      z
        .object({
          format: z.enum(["TIMED", "FIRST_SOLVE", "RACE"]),
          preset: z.enum(["QUICK", "STANDARD", "MARATHON"]),
          ratingMin: ratingStep,
          ratingMax: ratingStep,
        })
        .refine((v) => v.ratingMax >= v.ratingMin, {
          message: "Max rating must be at least the min rating",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [myHandle, liveLinks] = await Promise.all([
        ctx.db.platformHandle.findFirst({
          where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
          select: { id: true },
        }),
        ctx.db.duel.count({
          where: {
            challengerId: ctx.userId,
            status: "OPEN",
            createdAt: { gt: new Date(now.getTime() - INVITE_TTL_MS) },
          },
        }),
      ]);
      if (!myHandle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Verify your Codeforces handle first (Settings → Profile Links)",
        });
      }
      if (liveLinks >= 5) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have 5 open challenge links — cancel one first",
        });
      }

      const preset = DUEL_PRESETS[input.preset];
      const duel = await ctx.db.duel.create({
        data: {
          challengerId: ctx.userId,
          opponentId: null,
          status: "OPEN",
          inviteToken: randomUUID(),
          format: input.format,
          problemCount: preset.problemCount,
          durationSec: preset.durationSec,
          winTarget: winTargetFor(input.format, preset.problemCount),
          ratingMin: input.ratingMin,
          ratingMax: input.ratingMax,
        },
        include: duelInclude,
      });
      return { duel, joinUrl: joinUrlFor(appBaseUrl(ctx.headers), duel.inviteToken!) };
    }),

  /** What a visitor (possibly signed out) sees on the join page. Public but
   * returns only safe fields; viewer eligibility is computed when signed in. */
  joinInfo: publicProcedure
    .use(rateLimited("duel.joinInfo", 30, 60_000))
    .input(z.object({ token: z.string().min(10).max(64) }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      // Lazy expiry so the page never shows a stale OPEN state.
      await ctx.db.duel.updateMany({
        where: {
          inviteToken: input.token,
          status: "OPEN",
          createdAt: { lt: new Date(now.getTime() - INVITE_TTL_MS) },
        },
        data: { status: "EXPIRED" },
      });

      const duel = await ctx.db.duel.findUnique({
        where: { inviteToken: input.token },
        include: {
          challenger: {
            select: {
              ...profileSelect,
              handles: {
                where: { platform: "CODEFORCES" as const, verified: true },
                select: { handle: true, rating: true },
              },
            },
          },
        },
      });
      if (!duel) return { kind: "invalid" as const };
      if (duel.status === "EXPIRED") return { kind: "expired" as const };
      if (duel.status !== "OPEN") {
        const participant =
          ctx.userId != null &&
          (duel.challengerId === ctx.userId || duel.opponentId === ctx.userId);
        return { kind: "claimed" as const, duelId: participant ? duel.id : undefined };
      }
      if (ctx.userId === duel.challengerId) {
        return {
          kind: "own" as const,
          joinUrl: joinUrlFor(appBaseUrl(ctx.headers), input.token),
        };
      }

      let viewer = {
        signedIn: ctx.userId != null,
        hasVerifiedHandle: false,
        pairConflictDuelId: null as string | null,
      };
      if (ctx.userId) {
        const [handle, conflict] = await Promise.all([
          ctx.db.platformHandle.findFirst({
            where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
            select: { id: true },
          }),
          ctx.db.duel.findFirst({
            where: {
              status: { in: ["PENDING", "ACTIVE"] },
              OR: [
                { challengerId: ctx.userId, opponentId: duel.challengerId },
                { challengerId: duel.challengerId, opponentId: ctx.userId },
              ],
            },
            select: { id: true },
          }),
        ]);
        viewer = {
          signedIn: true,
          hasVerifiedHandle: handle != null,
          pairConflictDuelId: conflict?.id ?? null,
        };
      }

      const cf = duel.challenger.handles[0] ?? null;
      return {
        kind: "open" as const,
        challenger: {
          username: duel.challenger.username,
          name: duel.challenger.name,
          image: duel.challenger.image,
        },
        challengerCf: cf ? { handle: cf.handle, rating: cf.rating } : null,
        format: duel.format,
        problemCount: duel.problemCount,
        durationSec: duel.durationSec,
        ratingMin: duel.ratingMin,
        ratingMax: duel.ratingMax,
        viewer,
      };
    }),

  /** Claim an open duel — first eligible caller becomes the opponent and the
   * clock starts. Race-safe: the conditional updateMany is the single winner
   * gate; slow CF work happens before it, so a lost race costs one round-trip. */
  acceptOpen: protectedProcedure
    .use(rateLimited("duel.acceptOpen", 6, 60_000))
    .input(z.object({ token: z.string().min(10).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const duel = await ctx.db.duel.findUnique({ where: { inviteToken: input.token } });
      if (!duel) throw new TRPCError({ code: "NOT_FOUND" });
      if (duel.challengerId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't accept your own challenge",
        });
      }
      if (duel.status !== "OPEN") {
        throw new TRPCError({ code: "CONFLICT", message: "This challenge was already taken" });
      }

      const now = new Date();
      if (now.getTime() - duel.createdAt.getTime() > INVITE_TTL_MS) {
        await ctx.db.duel.updateMany({
          where: { id: duel.id, status: "OPEN" },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invite has expired" });
      }

      const conflict = await ctx.db.duel.findFirst({
        where: {
          status: { in: ["PENDING", "ACTIVE"] },
          OR: [
            { challengerId: ctx.userId, opponentId: duel.challengerId },
            { challengerId: duel.challengerId, opponentId: ctx.userId },
          ],
        },
        select: { id: true },
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "There's already a pending or active duel between you two",
        });
      }

      // Freeze both handles now — re-validates the challenger still has one.
      const [challengerHandle, opponentHandle] = await Promise.all([
        ctx.db.platformHandle.findFirst({
          where: { userId: duel.challengerId, platform: "CODEFORCES", verified: true },
          select: { handle: true },
        }),
        ctx.db.platformHandle.findFirst({
          where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
          select: { handle: true },
        }),
      ]);
      if (!challengerHandle || !opponentHandle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Both players need a verified Codeforces handle",
        });
      }

      // 3 upstream calls (problemset + both solve histories) — a few seconds.
      const problems = await selectDuelProblems(
        challengerHandle.handle,
        opponentHandle.handle,
        duel.ratingMin,
        duel.ratingMax,
        duel.problemCount,
      );

      // Atomic claim: exactly one concurrent acceptor can flip OPEN → ACTIVE.
      const claimed = await ctx.db.duel.updateMany({
        where: {
          id: duel.id,
          status: "OPEN",
          opponentId: null,
          createdAt: { gt: new Date(now.getTime() - INVITE_TTL_MS) },
        },
        data: {
          opponentId: ctx.userId,
          status: "ACTIVE",
          challengerHandle: challengerHandle.handle,
          opponentHandle: opponentHandle.handle,
          problems: problems as unknown as object[],
          startedAt: now,
          endsAt: new Date(now.getTime() + duel.durationSec * 1000),
          respondedAt: now,
        },
      });
      if (claimed.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Someone else just took this challenge",
        });
      }

      return ctx.db.duel.findUniqueOrThrow({ where: { id: duel.id }, include: duelInclude });
    }),

  /** Accept (starts the clock) or decline an incoming invite. */
  respond: protectedProcedure
    .use(rateLimited("duel.respond", 10, 60_000))
    .input(z.object({ duelId: z.string(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const duel = await ctx.db.duel.findUnique({ where: { id: input.duelId } });
      if (!duel || duel.opponentId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (duel.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "This invite was already handled" });
      }

      const now = new Date();
      if (now.getTime() - duel.createdAt.getTime() > INVITE_TTL_MS) {
        await ctx.db.duel.update({ where: { id: duel.id }, data: { status: "EXPIRED" } });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invite has expired" });
      }

      if (!input.accept) {
        return ctx.db.duel.update({
          where: { id: duel.id },
          data: { status: "DECLINED", respondedAt: now },
          include: duelInclude,
        });
      }

      // Freeze both handles now — later handle changes can't affect judging.
      const [challengerHandle, opponentHandle] = await Promise.all([
        ctx.db.platformHandle.findFirst({
          where: { userId: duel.challengerId, platform: "CODEFORCES", verified: true },
          select: { handle: true },
        }),
        ctx.db.platformHandle.findFirst({
          where: { userId: ctx.userId, platform: "CODEFORCES", verified: true },
          select: { handle: true },
        }),
      ]);
      if (!challengerHandle || !opponentHandle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Both players need a verified Codeforces handle",
        });
      }

      // 3 upstream calls (problemset + both solve histories) — a few seconds.
      const problems = await selectDuelProblems(
        challengerHandle.handle,
        opponentHandle.handle,
        duel.ratingMin,
        duel.ratingMax,
        duel.problemCount,
      );

      return ctx.db.duel.update({
        where: { id: duel.id },
        data: {
          status: "ACTIVE",
          challengerHandle: challengerHandle.handle,
          opponentHandle: opponentHandle.handle,
          problems: problems as unknown as object[],
          startedAt: now,
          endsAt: new Date(now.getTime() + duel.durationSec * 1000),
          respondedAt: now,
        },
        include: duelInclude,
      });
    }),

  /** Withdraw my own pending invite or open link (delete, mirroring friend.cancel). */
  cancel: protectedProcedure
    .input(z.object({ duelId: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.duel.deleteMany({
        where: { id: input.duelId, challengerId: ctx.userId, status: { in: ["PENDING", "OPEN"] } },
      }),
    ),

  /** All my duels, grouped. Also does the lazy housekeeping: expire stale
   * invites and finalize a few overdue ACTIVE duels. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const mine = { OR: [{ challengerId: ctx.userId }, { opponentId: ctx.userId }] };
    const now = new Date();

    await ctx.db.duel.updateMany({
      where: {
        ...mine,
        status: { in: ["PENDING", "OPEN"] },
        createdAt: { lt: new Date(now.getTime() - INVITE_TTL_MS) },
      },
      data: { status: "EXPIRED" },
    });

    const overdue = await ctx.db.duel.findMany({
      where: { ...mine, status: "ACTIVE", endsAt: { lt: now } },
      take: 3,
    });
    for (const d of overdue) {
      try {
        await checkDuel(ctx.db, d);
      } catch {
        // finalization is best-effort here; duel.state will retry
      }
    }

    const duels = await ctx.db.duel.findMany({
      where: {
        ...mine,
        status: { in: ["PENDING", "OPEN", "ACTIVE", "FINISHED"] },
      },
      include: duelInclude,
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const base = appBaseUrl(ctx.headers);
    return {
      incoming: duels.filter((d) => d.status === "PENDING" && d.opponentId === ctx.userId),
      outgoing: duels.filter((d) => d.status === "PENDING" && d.challengerId === ctx.userId),
      // OPEN rows are challenger-only by construction (null opponentId can't match me).
      open: duels
        .filter((d) => d.status === "OPEN")
        .map((d) => ({ ...d, joinUrl: joinUrlFor(base, d.inviteToken!) })),
      active: duels.filter((d) => d.status === "ACTIVE"),
      finished: duels.filter((d) => d.status === "FINISHED").slice(0, 20),
    };
  }),

  /** Live state for the duel page. Runs the (throttled) judge while ACTIVE. */
  state: protectedProcedure
    .use(rateLimited("duel.state", 60, 60_000))
    .input(z.object({ duelId: z.string() }))
    .query(async ({ ctx, input }) => {
      let duel = await ctx.db.duel.findUnique({ where: { id: input.duelId } });
      if (!duel || (duel.challengerId !== ctx.userId && duel.opponentId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (duel.status === "ACTIVE") {
        duel = await checkDuel(ctx.db, duel);
      }

      const ids = [duel.challengerId, duel.opponentId].filter((id): id is string => id != null);
      const users = await ctx.db.user.findMany({
        where: { id: { in: ids } },
        select: profileSelect,
      });
      const challenger = users.find((u) => u.id === duel.challengerId)!;
      const opponent = users.find((u) => u.id === duel.opponentId) ?? null;

      const problems = parseProblems(duel.problems);
      const scores = duel.startedAt
        ? {
            a: scoreOf(problems, duel.startedAt, "A"),
            b: scoreOf(problems, duel.startedAt, "B"),
          }
        : { a: { solved: 0, penaltySec: 0 }, b: { solved: 0, penaltySec: 0 } };

      return {
        ...duel,
        problems,
        challenger,
        opponent,
        scores,
        youAre: duel.challengerId === ctx.userId ? ("A" as const) : ("B" as const),
      };
    }),

  /** Read-only public summary of a FINISHED duel (spectator page + share
   * links). Everything returned is already public on Codeforces. */
  publicResult: publicProcedure
    .use(rateLimited("duel.publicResult", 30, 60_000))
    .input(z.object({ duelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const duel = await ctx.db.duel.findUnique({
        where: { id: input.duelId },
        include: duelInclude,
      });
      if (!duel || duel.status !== "FINISHED" || !duel.startedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const problems = parseProblems(duel.problems);
      const { inviteToken: _token, ...publicDuel } = duel;
      void _token; // stripped — never expose the join token publicly
      return {
        ...publicDuel,
        problems,
        scores: {
          a: scoreOf(problems, duel.startedAt, "A"),
          b: scoreOf(problems, duel.startedAt, "B"),
        },
      };
    }),

  /** Lifetime head-to-head between this duel's two players (participants
   * only). Separate from `state` so the 6-15s poll never recomputes it. */
  h2h: protectedProcedure
    .input(z.object({ duelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const duel = await ctx.db.duel.findUnique({
        where: { id: input.duelId },
        select: { challengerId: true, opponentId: true },
      });
      if (!duel || (duel.challengerId !== ctx.userId && duel.opponentId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!duel.opponentId) return null;
      const other = duel.challengerId === ctx.userId ? duel.opponentId : duel.challengerId;

      // Latest 50 finished pair duels — enough for counts + streak in practice.
      const finished = await ctx.db.duel.findMany({
        where: {
          status: "FINISHED",
          OR: [
            { challengerId: ctx.userId, opponentId: other },
            { challengerId: other, opponentId: ctx.userId },
          ],
        },
        select: { winnerId: true, draw: true },
        orderBy: { finishedAt: "desc" },
        take: 50,
      });

      let myWins = 0;
      let theirWins = 0;
      let draws = 0;
      for (const d of finished) {
        if (d.winnerId === ctx.userId) myWins += 1;
        else if (d.winnerId === other) theirWins += 1;
        else draws += 1;
      }

      // Streak: consecutive latest wins by one player, broken by a draw.
      let streak: { userId: string; count: number } | null = null;
      if (finished.length > 0 && finished[0].winnerId) {
        const leader = finished[0].winnerId;
        let count = 0;
        for (const d of finished) {
          if (d.winnerId !== leader) break;
          count += 1;
        }
        streak = { userId: leader, count };
      }

      return { myWins, theirWins, draws, total: finished.length, streak };
    }),

  /** Incoming actionable invites (nav badge). */
  pendingCount: protectedProcedure.query(({ ctx }) =>
    ctx.db.duel.count({
      where: {
        opponentId: ctx.userId,
        status: "PENDING",
        createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) },
      },
    }),
  ),
});
