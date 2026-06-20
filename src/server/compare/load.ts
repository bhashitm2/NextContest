import { compareProfiles, type CompareResult, type CompareUser } from "@/lib/compare";
import { prisma } from "@/lib/db";
import { normalizeUsername } from "@/lib/username";

const COMPARE_SELECT = {
  id: true,
  username: true,
  name: true,
  image: true,
  handles: {
    where: { verified: true },
    select: {
      platform: true,
      rating: true,
      maxRating: true,
      problemsSolved: true,
      stats: true,
    },
  },
} as const;

export type Comparison = {
  result: CompareResult;
  viewerId: string;
  targetId: string;
  targetLabel: string;
  isSelf: boolean;
  /** Both sides have at least one verified handle (a meaningful comparison). */
  hasData: boolean;
  viewerHasData: boolean;
};

export type LoadOutcome =
  | { status: "ok"; comparison: Comparison }
  | { status: "not-found" }
  | { status: "not-friends"; targetLabel: string };

/**
 * Resolve the viewer + target users, enforce the friend-or-self gate, and run
 * the deterministic comparison. Shared by the `/compare/[username]` page and the
 * `compare.verdict` tRPC procedure so the gating + selection can't drift apart.
 */
export async function loadComparison(
  viewerId: string,
  usernameRaw: string,
): Promise<LoadOutcome> {
  const [me, them] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, select: COMPARE_SELECT }),
    prisma.user.findUnique({
      where: { username: normalizeUsername(usernameRaw) },
      select: COMPARE_SELECT,
    }),
  ]);

  if (!me || !them) return { status: "not-found" };

  const isSelf = me.id === them.id;
  const targetLabel = them.name ?? them.username ?? usernameRaw;

  if (!isSelf) {
    const friends = await prisma.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: me.id, addresseeId: them.id },
          { requesterId: them.id, addresseeId: me.id },
        ],
      },
    });
    if (friends === 0) return { status: "not-friends", targetLabel };
  }

  const toCompareUser = (u: NonNullable<typeof me>): CompareUser => ({
    username: u.username,
    name: u.name,
    image: u.image,
    handles: u.handles,
  });

  return {
    status: "ok",
    comparison: {
      result: compareProfiles(toCompareUser(me), toCompareUser(them)),
      viewerId: me.id,
      targetId: them.id,
      targetLabel,
      isSelf,
      hasData: me.handles.length > 0 && them.handles.length > 0,
      viewerHasData: me.handles.length > 0,
    },
  };
}
