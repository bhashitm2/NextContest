"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { FriendRow, type RouterOutputs } from "./friend-row";

type Tab = "received" | "sent";

export function RequestsView({
  initialIncoming,
  initialOutgoing,
}: {
  initialIncoming: RouterOutputs["friend"]["incoming"];
  initialOutgoing: RouterOutputs["friend"]["outgoing"];
}) {
  const utils = api.useUtils();
  const [tab, setTab] = useState<Tab>("received");

  const incoming = api.friend.incoming.useQuery(undefined, { initialData: initialIncoming });
  const outgoing = api.friend.outgoing.useQuery(undefined, { initialData: initialOutgoing });

  const invalidate = () => {
    utils.friend.incoming.invalidate();
    utils.friend.outgoing.invalidate();
    utils.friend.pendingCount.invalidate();
    utils.friend.list.invalidate();
  };

  const respond = api.friend.respond.useMutation({ onSuccess: invalidate });
  const cancel = api.friend.cancel.useMutation({ onSuccess: invalidate });
  const busy = respond.isPending || cancel.isPending;

  const received = incoming.data ?? [];
  const sent = outgoing.data ?? [];

  const tabBtn = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`flex-1 rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-colors ${
        tab === value ? "bg-cp-accent text-cp-accent-ink" : "text-cp-dim hover:text-cp-text"
      }`}
    >
      {label}
      {count > 0 ? <span className="ml-1.5 opacity-80">({count})</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-[11px] border border-cp-line bg-cp-surface p-1">
        {tabBtn("received", "Received", received.length)}
        {tabBtn("sent", "Sent", sent.length)}
      </div>

      {tab === "received" ? (
        received.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-cp-dim">No incoming requests.</p>
        ) : (
          <div className="space-y-2">
            {received.map((r) => (
              <FriendRow
                key={r.id}
                username={r.requester.username}
                name={r.requester.name}
                image={r.requester.image}
                right={
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => respond.mutate({ requestId: r.id, accept: true })}
                    >
                      <Check /> Accept
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={busy}
                      title="Decline"
                      onClick={() => respond.mutate({ requestId: r.id, accept: false })}
                    >
                      <X />
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )
      ) : sent.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-cp-dim">No sent requests.</p>
      ) : (
        <div className="space-y-2">
          {sent.map((r) => (
            <FriendRow
              key={r.id}
              username={r.addressee.username}
              name={r.addressee.name}
              image={r.addressee.image}
              right={
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => cancel.mutate({ requestId: r.id })}
                >
                  Cancel
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
