"use client";

import { Check, Crown, Minus, X } from "lucide-react";

import { CountdownTimer } from "@/components/contest/countdown-timer";
import type { RouterOutputs } from "@/components/friends/friend-row";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { DuelRow } from "./duel-row";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** The /duels dashboard: incoming/outgoing invites, live duels, history. */
export function DuelsManager({
  myId,
  initialList,
}: {
  myId: string;
  initialList: RouterOutputs["duel"]["list"];
}) {
  const utils = api.useUtils();
  const list = api.duel.list.useQuery(undefined, { initialData: initialList });

  const invalidate = () => utils.duel.invalidate();
  const respond = api.duel.respond.useMutation({ onSuccess: invalidate });
  const cancel = api.duel.cancel.useMutation({ onSuccess: invalidate });
  const busy = respond.isPending || cancel.isPending;

  const { incoming, outgoing, active, finished } = list.data;
  const empty =
    incoming.length === 0 && outgoing.length === 0 && active.length === 0 && finished.length === 0;

  if (empty) {
    return (
      <div className="rounded-[14px] border border-dashed border-cp-line px-6 py-12 text-center">
        <p className="text-[15px] font-semibold text-cp-text">No duels yet</p>
        <p className="mx-auto mt-1 max-w-[380px] text-[13px] text-cp-dim">
          Challenge a friend to a Codeforces duel — same problems, one clock, first blood or most
          solves takes it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {respond.error ? (
        <p className="rounded-[10px] border border-cp-line bg-cp-surface px-3.5 py-2.5 text-[13px] text-red-400">
          {respond.error.message}
        </p>
      ) : null}

      {active.length > 0 ? (
        <Section title="Live">
          {active.map((d) => (
            <DuelRow
              key={d.id}
              duel={d}
              myId={myId}
              lead={d.challengerId === myId ? "— you challenged" : "— challenged you"}
              href={`/duels/${d.id}`}
              right={d.endsAt ? <CountdownTimer target={new Date(d.endsAt)} size="sm" /> : null}
            />
          ))}
        </Section>
      ) : null}

      {incoming.length > 0 ? (
        <Section title="Incoming challenges">
          {incoming.map((d) => (
            <DuelRow
              key={d.id}
              duel={d}
              myId={myId}
              lead="challenged you"
              right={
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => respond.mutate({ duelId: d.id, accept: true })}
                  >
                    <Check data-icon="inline-start" />
                    {respond.isPending ? "Picking problems…" : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => respond.mutate({ duelId: d.id, accept: false })}
                  >
                    <X data-icon="inline-start" />
                    Decline
                  </Button>
                </>
              }
            />
          ))}
        </Section>
      ) : null}

      {outgoing.length > 0 ? (
        <Section title="Waiting on them">
          {outgoing.map((d) => (
            <DuelRow
              key={d.id}
              duel={d}
              myId={myId}
              lead="— you challenged"
              right={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => cancel.mutate({ duelId: d.id })}
                >
                  Cancel
                </Button>
              }
            />
          ))}
        </Section>
      ) : null}

      {finished.length > 0 ? (
        <Section title="Finished">
          {finished.map((d) => {
            const won = d.winnerId === myId;
            const outcome = d.draw ? (
              <span className="inline-flex items-center gap-1 font-mono text-[12px] font-bold text-cp-dim">
                <Minus className="size-3.5" /> Draw
              </span>
            ) : won ? (
              <span className="inline-flex items-center gap-1 font-mono text-[12px] font-bold text-emerald-500">
                <Crown className="size-3.5" /> Won
              </span>
            ) : (
              <span className="font-mono text-[12px] font-bold text-red-400">Lost</span>
            );
            return (
              <DuelRow
                key={d.id}
                duel={d}
                myId={myId}
                lead={d.challengerId === myId ? "— you challenged" : "— challenged you"}
                href={`/duels/${d.id}`}
                right={outcome}
              />
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
