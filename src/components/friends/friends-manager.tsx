"use client";

import { Check, Search, Swords, UserPlus, UserX, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

function Avatar({
  image,
  name,
  username,
  size = 40,
}: {
  image: string | null;
  name: string | null;
  username: string | null;
  size?: number;
}) {
  const initial = (name ?? username ?? "?").charAt(0).toUpperCase();
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-cp-line object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full text-sm font-bold text-cp-accent-ink"
    >
      <span className="grid size-full place-items-center rounded-full" style={{ background: "var(--cp-accent)" }}>
        {initial}
      </span>
    </span>
  );
}

function FriendRow({
  username,
  name,
  image,
  right,
}: {
  username: string | null;
  name: string | null;
  image: string | null;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-cp-line bg-cp-surface px-3.5 py-2.5">
      <Avatar image={image} name={name} username={username} />
      <div className="min-w-0">
        {name ? <div className="truncate text-[14px] font-semibold text-cp-text">{name}</div> : null}
        <div className="truncate font-mono text-[12px] text-cp-dim">@{username}</div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{right}</div>
    </div>
  );
}

export function FriendsManager({ myUsername }: { myUsername: string | null }) {
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const results = api.friend.search.useQuery({ query: debounced }, { enabled: debounced.length >= 1 });
  const friends = api.friend.list.useQuery();
  const incoming = api.friend.incoming.useQuery();
  const outgoing = api.friend.outgoing.useQuery();

  const invalidateAll = () => {
    utils.friend.search.invalidate();
    utils.friend.list.invalidate();
    utils.friend.incoming.invalidate();
    utils.friend.outgoing.invalidate();
    utils.friend.pendingCount.invalidate();
  };

  const request = api.friend.request.useMutation({ onSuccess: invalidateAll });
  const respond = api.friend.respond.useMutation({ onSuccess: invalidateAll });
  const cancel = api.friend.cancel.useMutation({ onSuccess: invalidateAll });
  const remove = api.friend.remove.useMutation({ onSuccess: invalidateAll });
  const busy = request.isPending || respond.isPending || cancel.isPending || remove.isPending;

  return (
    <div className="space-y-7">
      {/* Your CodeTag */}
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

      {/* Incoming requests */}
      {(incoming.data ?? []).length > 0 ? (
        <div>
          <h2 className="mb-2 font-display text-[16px] font-bold">
            Requests <span className="text-cp-dim">({incoming.data!.length})</span>
          </h2>
          <div className="space-y-2">
            {incoming.data!.map((r) => (
              <FriendRow
                key={r.id}
                username={r.requester.username}
                name={r.requester.name}
                image={r.requester.image}
                right={
                  <>
                    <Button size="sm" disabled={busy} onClick={() => respond.mutate({ requestId: r.id, accept: true })}>
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
        </div>
      ) : null}

      {/* Outgoing pending */}
      {(outgoing.data ?? []).length > 0 ? (
        <div>
          <h2 className="mb-2 font-display text-[16px] font-bold">Sent</h2>
          <div className="space-y-2">
            {outgoing.data!.map((r) => (
              <FriendRow
                key={r.id}
                username={r.addressee.username}
                name={r.addressee.name}
                image={r.addressee.image}
                right={
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => cancel.mutate({ requestId: r.id })}>
                    Cancel
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Friends */}
      <div>
        <h2 className="mb-2 font-display text-[16px] font-bold">
          Friends <span className="text-cp-dim">({(friends.data ?? []).length})</span>
        </h2>
        {friends.isLoading ? (
          <p className="px-1 text-[13px] text-cp-dim">Loading…</p>
        ) : (friends.data ?? []).length === 0 ? (
          <p className="px-1 text-[13px] text-cp-dim">No friends yet — search by CodeTag above.</p>
        ) : (
          <div className="space-y-2">
            {friends.data!.map((f) => (
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
