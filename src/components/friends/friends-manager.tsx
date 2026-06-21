"use client";

import { Check, ChevronRight, Search, Swords, UserPlus, UserX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { FriendRow, type RouterOutputs } from "./friend-row";

export function FriendsManager({
  myUsername,
  initialFriends,
  initialPendingCount,
}: {
  myUsername: string | null;
  initialFriends: RouterOutputs["friend"]["list"];
  initialPendingCount: number;
}) {
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const results = api.friend.search.useQuery(
    { query: debounced },
    { enabled: debounced.length >= 1 },
  );
  const friends = api.friend.list.useQuery(undefined, { initialData: initialFriends });
  const pending = api.friend.pendingCount.useQuery(undefined, { initialData: initialPendingCount });

  const invalidate = () => {
    utils.friend.search.invalidate();
    utils.friend.list.invalidate();
    utils.friend.pendingCount.invalidate();
  };

  const request = api.friend.request.useMutation({ onSuccess: invalidate });
  const respond = api.friend.respond.useMutation({ onSuccess: invalidate });
  const remove = api.friend.remove.useMutation({ onSuccess: invalidate });
  const busy = request.isPending || respond.isPending || remove.isPending;

  const pendingCount = pending.data ?? 0;
  const friendList = friends.data ?? [];

  return (
    <div className="space-y-6">
      {/* Requests entry */}
      <Link
        href="/friends/requests"
        className="flex items-center justify-between rounded-[14px] border border-cp-line bg-cp-surface px-4 py-3.5 transition-colors hover:border-cp-accent"
      >
        <span className="flex items-center gap-2.5">
          <UserPlus className="size-4 text-cp-accent" />
          <span className="text-[14px] font-semibold text-cp-text">Requests</span>
          {pendingCount > 0 ? (
            <span className="grid min-w-[18px] place-items-center rounded-full bg-cp-accent px-1.5 text-[11px] font-bold leading-5 text-cp-accent-ink">
              {pendingCount}
            </span>
          ) : null}
        </span>
        <ChevronRight className="size-4 text-cp-dim" />
      </Link>

      {/* CodeTag */}
      <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
        <h2 className="font-display text-[16px] font-bold">Your CodeTag</h2>
        {myUsername ? (
          <p className="mt-1 text-[13px] text-cp-dim">
            Share <span className="font-mono font-semibold text-cp-accent">@{myUsername}</span> so
            friends can add you.
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-cp-dim">
            Set a username in{" "}
            <Link href="/settings" className="text-cp-accent hover:underline">
              Settings
            </Link>{" "}
            so people can find you.
          </p>
        )}
      </div>

      {/* Search */}
      <div>
        <h2 className="mb-2 font-display text-[16px] font-bold">Find friends</h2>
        <div className="flex items-center rounded-[10px] border border-cp-line bg-cp-bg px-3 focus-within:border-cp-accent">
          <Search className="size-4 text-cp-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by CodeTag (username)…"
            className="w-full bg-transparent px-2.5 py-2.5 text-[14px] text-cp-text outline-none placeholder:text-cp-faint"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {debounced.length >= 1 ? (
          <div className="mt-2.5 space-y-2">
            {results.isLoading ? (
              <p className="px-1 text-[13px] text-cp-dim">Searching…</p>
            ) : (results.data ?? []).length === 0 ? (
              <p className="px-1 text-[13px] text-cp-dim">No users found for “{debounced}”.</p>
            ) : (
              (results.data ?? []).map((u) => (
                <FriendRow
                  key={u.username}
                  username={u.username}
                  name={u.name}
                  image={u.image}
                  right={
                    u.status === "friends" ? (
                      <span className="text-[12px] font-medium text-emerald-500">Friends</span>
                    ) : u.status === "outgoing" ? (
                      <span className="text-[12px] text-cp-dim">Requested</span>
                    ) : u.status === "incoming" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => respond.mutate({ requestId: u.requestId!, accept: true })}
                      >
                        <Check /> Accept
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => request.mutate({ username: u.username! })}
                      >
                        <UserPlus /> Add
                      </Button>
                    )
                  }
                />
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Friends */}
      <div>
        <h2 className="mb-2 font-display text-[16px] font-bold">
          Friends <span className="text-cp-dim">({friendList.length})</span>
        </h2>
        {friendList.length === 0 ? (
          <p className="px-1 text-[13px] text-cp-dim">No friends yet — search by CodeTag above.</p>
        ) : (
          <div className="space-y-2">
            {friendList.map((f) => (
              <FriendRow
                key={f.username}
                username={f.username}
                name={f.name}
                image={f.image}
                right={
                  <>
                    <span className="mr-1 hidden font-mono text-[12px] text-cp-dim sm:inline">
                      {f.totalSolved.toLocaleString()} solved
                    </span>
                    <Button size="sm" render={<Link href={`/compare/${f.username}`} />}>
                      <Swords /> Compare
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={`/u/${f.username}`} />}>
                      View
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={busy}
                      title="Unfriend"
                      onClick={() => remove.mutate({ username: f.username! })}
                    >
                      <UserX />
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
