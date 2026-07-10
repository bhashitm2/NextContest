import { Clock, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth, signIn } from "@/auth";
import { AcceptOpenButton, CopyJoinLinkButton } from "@/components/duel/join-open-duel";
import { Avatar } from "@/components/friends/friend-row";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { DUEL_FORMATS, type DuelFormatKey } from "@/lib/duel";
import { createCaller } from "@/server/routers/_app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duel challenge — NextContest",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-cp-line bg-cp-surface p-6">{children}</div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-10 text-center text-[14px] text-cp-dim">
      {children}
    </div>
  );
}

export default async function JoinDuelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const caller = createCaller({
    db: prisma,
    userId: session?.user?.id ?? null,
    headers: new Headers(),
  });

  let info: Awaited<ReturnType<typeof caller.duel.joinInfo>>;
  try {
    info = await caller.duel.joinInfo({ token });
  } catch {
    info = { kind: "invalid" as const };
  }

  return (
    <main className="mx-auto w-full max-w-[520px] px-4 py-12 sm:px-[22px]">
      <div className="mb-6 text-center">
        <span className="inline-grid size-12 place-items-center rounded-[14px] bg-cp-surface text-cp-accent">
          <Swords className="size-6" />
        </span>
        <h1 className="mt-3 font-display text-[22px] font-bold text-cp-text">Duel challenge</h1>
      </div>

      {info.kind === "invalid" ? (
        <Notice>
          This challenge link doesn&apos;t exist — it may have been cancelled.{" "}
          <Link href="/duels" className="text-cp-accent hover:underline">
            Go to duels
          </Link>
        </Notice>
      ) : info.kind === "expired" ? (
        <Notice>
          This challenge link has expired — links last 24 hours.{" "}
          <Link href="/duels" className="text-cp-accent hover:underline">
            Go to duels
          </Link>
        </Notice>
      ) : info.kind === "claimed" ? (
        <Notice>
          This challenge was already taken.{" "}
          {info.duelId ? (
            <Link href={`/duels/${info.duelId}`} className="text-cp-accent hover:underline">
              Open the duel
            </Link>
          ) : (
            <Link href="/duels" className="text-cp-accent hover:underline">
              Go to duels
            </Link>
          )}
        </Notice>
      ) : info.kind === "own" ? (
        <Card>
          <p className="text-[14px] text-cp-text">
            This is <span className="font-semibold">your</span> open challenge. Share the link —
            the first eligible player to accept starts the duel.
          </p>
          <div className="mt-3">
            <CopyJoinLinkButton url={info.joinUrl} />
          </div>
        </Card>
      ) : (
        <OpenChallenge info={info} token={token} />
      )}
    </main>
  );
}

function OpenChallenge({
  info,
  token,
}: {
  info: {
    challenger: { username: string | null; name: string | null; image: string | null };
    challengerCf: { handle: string; rating: number | null } | null;
    format: string;
    problemCount: number;
    durationSec: number;
    ratingMin: number;
    ratingMax: number;
    viewer: { signedIn: boolean; hasVerifiedHandle: boolean; pairConflictDuelId: string | null };
  };
  token: string;
}) {
  const format = DUEL_FORMATS[info.format as DuelFormatKey]?.label ?? info.format;
  const meta = `${format} · ${info.problemCount} problems · ${info.ratingMin}–${info.ratingMax}`;
  const { challenger, challengerCf, viewer } = info;

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar
          image={challenger.image}
          name={challenger.name}
          username={challenger.username}
          size={48}
        />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-cp-text">
            {challenger.name ?? `@${challenger.username}`}
          </div>
          {challengerCf ? (
            <div className="truncate font-mono text-[12px] text-cp-dim">
              {challengerCf.handle}
              {challengerCf.rating != null ? ` · ${challengerCf.rating}` : ""}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-[14px] text-cp-text">challenges you to a Codeforces duel:</p>
      <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-cp-line px-3.5 py-2.5 font-mono text-[13px] text-cp-dim">
        <Clock className="size-4 shrink-0" />
        {meta} · {Math.round(info.durationSec / 60)} min
      </div>

      <div className="mt-5">
        {!viewer.signedIn ? (
          <>
            <p className="mb-3 text-center text-[13px] text-cp-dim">
              Sign in to accept the challenge.
            </p>
            <div className="flex justify-center gap-2">
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: `/duels/join/${token}` });
                }}
              >
                <Button type="submit">Sign in with Google</Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("github", { redirectTo: `/duels/join/${token}` });
                }}
              >
                <Button type="submit" variant="outline">
                  GitHub
                </Button>
              </form>
            </div>
          </>
        ) : !viewer.hasVerifiedHandle ? (
          <p className="rounded-[10px] border border-dashed border-cp-line px-3.5 py-3 text-center text-[13px] text-cp-dim">
            You need a verified Codeforces handle to duel —{" "}
            <Link href="/settings" className="text-cp-accent hover:underline">
              verify one in Settings
            </Link>{" "}
            and come back to this link.
          </p>
        ) : viewer.pairConflictDuelId ? (
          <p className="rounded-[10px] border border-dashed border-cp-line px-3.5 py-3 text-center text-[13px] text-cp-dim">
            You already have a duel going with this player —{" "}
            <Link
              href={`/duels/${viewer.pairConflictDuelId}`}
              className="text-cp-accent hover:underline"
            >
              open it
            </Link>
            .
          </p>
        ) : (
          <>
            <AcceptOpenButton token={token} />
            <p className="mt-2 text-center text-[12px] text-cp-faint">
              Accepting starts the clock immediately — problems are picked that neither of you
              has solved.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
