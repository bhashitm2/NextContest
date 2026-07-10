"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, type RouterOutputs } from "@/components/friends/friend-row";
import { DUEL_FORMATS, type DuelFormatKey } from "@/lib/duel";

export type DuelListItem = RouterOutputs["duel"]["list"]["incoming"][number];

/** "Timed · 5 problems · 800–1200" */
export function duelMeta(duel: DuelListItem): string {
  const format = DUEL_FORMATS[duel.format as DuelFormatKey]?.label ?? duel.format;
  return `${format} · ${duel.problemCount} problems · ${duel.ratingMin}–${duel.ratingMax}`;
}

/** The other player, from my point of view. Every non-OPEN duel has an
 * opponent; the challenger fallback only exists to keep the type non-null. */
export function counterpartOf(duel: DuelListItem, myId: string) {
  return (duel.challengerId === myId ? duel.opponent : duel.challenger) ?? duel.challenger;
}

export function DuelRow({
  duel,
  myId,
  lead,
  right,
  href,
}: {
  duel: DuelListItem;
  myId: string;
  lead: string; // e.g. "challenged you" / "you challenged"
  right: ReactNode;
  href?: string;
}) {
  const other = counterpartOf(duel, myId);

  const body = (
    <>
      <Avatar image={other.image} name={other.name} username={other.username} />
      <div className="min-w-0">
        <div className="truncate text-[14px] text-cp-text">
          <span className="font-semibold">{other.name ?? `@${other.username}`}</span>{" "}
          <span className="text-cp-dim">{lead}</span>
        </div>
        <div className="truncate font-mono text-[12px] text-cp-dim">{duelMeta(duel)}</div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{right}</div>
    </>
  );

  const className =
    "flex items-center gap-3 rounded-[12px] border border-cp-line bg-cp-surface px-3.5 py-2.5";

  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-cp-accent`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
