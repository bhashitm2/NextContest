import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  DUEL_PRESETS,
  INVITE_TTL_MS,
  RATING_MAX,
  RATING_MIN,
  winTargetFor,
} from "@/lib/duel";
import { normalizeUsername } from "@/lib/username";
import { checkDuel, parseProblems, scoreOf } from "@/server/duel/judge";
import { selectDuelProblems } from "@/server/duel/select-problems";
import { createTRPCRouter, protectedProcedure, rateLimited } from "@/server/trpc";

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

  /** Withdraw my own pending invite (delete, mirroring friend.cancel). */
  cancel: protectedProcedure
    .input(z.object({ duelId: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.duel.deleteMany({
        where: { id: input.duelId, challengerId: ctx.userId, status: "PENDING" },
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
        status: "PENDING",
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
        status: { in: ["PENDING", "ACTIVE", "FINISHED"] },
      },
      include: duelInclude,
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return {
      incoming: duels.filter((d) => d.status === "PENDING" && d.opponentId === ctx.userId),
      outgoing: duels.filter((d) => d.status === "PENDING" && d.challengerId === ctx.userId),
      active: duels.filter((d) => d.status === "ACTIVE"),
      finished: duels.filter((d) => d.status === "FINISHED").slice(0, 20),
    };
  }),

  /** Live state for the duel page. Runs the (throttled) judge while ACTIVE. */
  state: protectedProcedure
    .use(rateLimited("duel.state", 40, 60_000))
    .input(z.object({ duelId: z.string() }))
    .query(async ({ ctx, input }) => {
      let duel = await ctx.db.duel.findUnique({ where: { id: input.duelId } });
      if (!duel || (duel.challengerId !== ctx.userId && duel.opponentId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (duel.status === "ACTIVE") {
        duel = await checkDuel(ctx.db, duel);
      }

      const users = await ctx.db.user.findMany({
        where: { id: { in: [duel.challengerId, duel.opponentId] } },
        select: profileSelect,
      });
      const challenger = users.find((u) => u.id === duel.challengerId)!;
      const opponent = users.find((u) => u.id === duel.opponentId)!;

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
