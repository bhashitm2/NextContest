"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { type ReactNode, useState } from "react";

import { avatarSrc } from "@/lib/avatar";
import type { AppRouter } from "@/server/routers/_app";

/** Typed tRPC outputs, for seeding client queries with server-prefetched data. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function Avatar({
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
  const [failed, setFailed] = useState(false);
  const initial = (name ?? username ?? "?").charAt(0).toUpperCase();
  const src = avatarSrc(image);

  if (!src || failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full text-sm font-bold text-cp-accent-ink"
      >
        <span
          className="grid size-full place-items-center rounded-full"
          style={{ background: "var(--cp-accent)" }}
        >
          {initial}
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-cp-line object-cover"
    />
  );
}

export function FriendRow({
  username,
  name,
  image,
  right,
}: {
  username: string | null;
  name: string | null;
  image: string | null;
  right: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-cp-line bg-cp-surface px-3.5 py-2.5">
      <Avatar image={image} name={name} username={username} />
      <div className="min-w-0">
        {name ? (
          <div className="truncate text-[14px] font-semibold text-cp-text">{name}</div>
        ) : null}
        <div className="truncate font-mono text-[12px] text-cp-dim">@{username}</div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{right}</div>
    </div>
  );
}
