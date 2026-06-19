import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { totalSolved } from "@/lib/profile";
import { normalizeUsername } from "@/lib/username";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export type RelStatus = "none" | "outgoing" | "incoming" | "friends";

/** Public-safe friend profile fields + verified solved counts (for totals). */
const friendSelect = {
  username: true,
  name: true,
  image: true,
  handles: { where: { verified: true }, select: { problemsSolved: true } },
} as const;

export const friendRouter = createTRPCRouter({
  /** Search public users by CodeTag (username), annotated with our relationship. */
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const q = normalizeUsername(input.query);
      const users = await ctx.db.user.findMany({
        where: { username: { contains: q, mode: "insensitive" }, id: { not: ctx.userId } },
        select: { id: true, username: true, name: true, image: true },
        take: 10,
      });
      if (users.length === 0) return [];

      const ids = users.map((u) => u.id);
      const edges = await ctx.db.friendship.findMany({
        where: {
          OR: [
            { requesterId: ctx.userId, addresseeId: { in: ids } },
            { addresseeId: ctx.userId, requesterId: { in: ids } },
          ],
        },
      });

      return users.map((u) => {
        const edge = edges.find((e) => e.requesterId === u.id || e.addresseeId === u.id);
        let status: RelStatus = "none";
        let requestId: string | undefined;
        if (edge) {
          if (edge.status === "ACCEPTED") {
            status = "friends";
          } else {
            status = edge.requesterId === ctx.userId ? "outgoing" : "incoming";
            requestId = edge.id;
          }
        }
        return { username: u.username, name: u.name, image: u.image, status, requestId };
      });
    }),

  /** Send a friend request by username. Auto-accepts a reverse pending request. */
  request: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findUnique({
        where: { username: normalizeUsername(input.username) },
        select: { id: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that CodeTag." });
      if (target.id === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't add yourself." });
      }

      const edge = await ctx.db.friendship.findFirst({
        where: {
          OR: [
            { requesterId: ctx.userId, addresseeId: target.id },
            { requesterId: target.id, addresseeId: ctx.userId },
          ],
        },
      });

      if (edge) {
        if (edge.status === "ACCEPTED") return { status: "friends" as RelStatus };
        if (edge.requesterId === ctx.userId) return { status: "outgoing" as RelStatus };
        // They already requested us → accept it.
        await ctx.db.friendship.update({
          where: { id: edge.id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });
        return { status: "friends" as RelStatus };
      }

      await ctx.db.friendship.create({
        data: { requesterId: ctx.userId, addresseeId: target.id },
      });
      return { status: "outgoing" as RelStatus };
    }),

  /** Accept or decline an incoming request (addressee only). */
  respond: protectedProcedure
    .input(z.object({ requestId: z.string(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.friendship.findUnique({ where: { id: input.requestId } });
      if (!req || req.addresseeId !== ctx.userId || req.status !== "PENDING") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }
      if (input.accept) {
        await ctx.db.friendship.update({
          where: { id: req.id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });
        return { accepted: true };
      }
      await ctx.db.friendship.delete({ where: { id: req.id } });
      return { accepted: false };
    }),

  /** Withdraw an outgoing pending request. */
  cancel: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.friendship.deleteMany({
        where: { id: input.requestId, requesterId: ctx.userId, status: "PENDING" },
      });
      return { ok: true };
    }),

  /** Unfriend (removes the accepted edge in either direction). */
  remove: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findUnique({
        where: { username: normalizeUsername(input.username) },
        select: { id: true },
      });
      if (!target) return { ok: true };
      await ctx.db.friendship.deleteMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: ctx.userId, addresseeId: target.id },
            { requesterId: target.id, addresseeId: ctx.userId },
          ],
        },
      });
      return { ok: true };
    }),

  /** Accepted friends, with total verified problems solved. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const edges = await ctx.db.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: ctx.userId }, { addresseeId: ctx.userId }] },
      include: {
        requester: { select: friendSelect },
        addressee: { select: friendSelect },
      },
      orderBy: { respondedAt: "desc" },
    });
    return edges.map((e) => {
      const f = e.requesterId === ctx.userId ? e.addressee : e.requester;
      return {
        username: f.username,
        name: f.name,
        image: f.image,
        totalSolved: totalSolved(f.handles),
      };
    });
  }),

  /** Incoming pending requests (for the requests list). */
  incoming: protectedProcedure.query(({ ctx }) =>
    ctx.db.friendship.findMany({
      where: { addresseeId: ctx.userId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        requester: { select: { username: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  /** Outgoing pending requests (so the UI can show "Requested"). */
  outgoing: protectedProcedure.query(({ ctx }) =>
    ctx.db.friendship.findMany({
      where: { requesterId: ctx.userId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        addressee: { select: { username: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  /** Count of incoming pending requests (nav badge). */
  pendingCount: protectedProcedure.query(({ ctx }) =>
    ctx.db.friendship.count({ where: { addresseeId: ctx.userId, status: "PENDING" } }),
  ),
});
