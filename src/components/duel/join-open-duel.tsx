"use client";

import { Check, Copy, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

/** Accept button for the join page — claims the open duel and jumps into it.
 * A lost race (someone else claimed first) surfaces as an inline error. */
export function AcceptOpenButton({ token }: { token: string }) {
  const router = useRouter();
  const accept = api.duel.acceptOpen.useMutation({
    onSuccess: (duel) => router.push(`/duels/${duel.id}`),
  });

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={accept.isPending}
        onClick={() => accept.mutate({ token })}
      >
        <Swords data-icon="inline-start" />
        {accept.isPending ? "Picking problems…" : "Accept challenge"}
      </Button>
      {accept.error ? (
        <p className="text-center text-[13px] text-red-400">{accept.error.message}</p>
      ) : null}
    </div>
  );
}

/** Copy-to-clipboard for a join URL (used on the "your own link" state). */
export function CopyJoinLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Challenge link"
        className="min-w-0 flex-1 rounded-[10px] border border-cp-line bg-cp-surface px-2.5 py-2 font-mono text-[12px] text-cp-text focus:outline-none"
      />
      <Button variant="outline" onClick={copy}>
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
