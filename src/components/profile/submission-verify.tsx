"use client";

import { BadgeCheck, Check, Copy, ExternalLink, Loader2, Swords } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Challenge = {
  name: string;
  submitUrl: string;
  snippet: string;
  languageHint: string;
  windowMs: number;
};

/** Compile-error verification flow for Codeforces / AtCoder: start a challenge,
 * submit a deliberate CE to the pinned problem, then check. */
export function SubmissionVerify({
  platform,
  label,
}: {
  platform: "CODEFORCES" | "ATCODER";
  label: string;
}) {
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const start = api.handle.startSubmissionChallenge.useMutation({
    onSuccess: (d) => {
      setChallenge(d);
      setDeadline(Date.now() + d.windowMs);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });
  const check = api.handle.verifySubmission.useMutation({
    onSuccess: () => {
      setError(null);
      utils.handle.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const busy = start.isPending || check.isPending;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!challenge) {
    return (
      <div className="space-y-2.5">
        <p className="text-[13px] text-cp-dim">
          Prove it&apos;s you by submitting a deliberate{" "}
          <span className="font-semibold text-cp-text">compile error</span> to a random {label}{" "}
          problem — we detect it from your submissions. Harmless: it won&apos;t count as solved or
          change your rating.
        </p>
        <Button type="button" disabled={busy} onClick={() => start.mutate({ platform })}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <Swords />} Start challenge
        </Button>
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  const msLeft = deadline ? Math.max(0, deadline - now) : 0;
  const mmss = `${Math.floor(msLeft / 60000)}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <ol className="space-y-2 text-[13px] text-cp-dim">
        <li>
          1. Open{" "}
          <a
            href={challenge.submitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-cp-accent hover:underline"
          >
            {challenge.name} <ExternalLink className="size-3.5" />
          </a>
        </li>
        <li>
          2. Submit this code (it won&apos;t compile — that&apos;s the point):
          <div className="mt-1 flex items-center gap-2 rounded-[8px] border border-cp-line bg-cp-bg px-3 py-2">
            <code className="flex-1 truncate font-mono text-[13px] text-cp-accent">
              {challenge.snippet}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(challenge.snippet)}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <span className="mt-1 block text-[11px] text-cp-faint">{challenge.languageHint}</span>
        </li>
        <li>
          3. Come back and check{" "}
          {msLeft > 0 ? <span className="font-mono text-cp-text">({mmss})</span> : null}
        </li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => check.mutate({ platform })}>
          {check.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />} I&apos;ve
          submitted — Check
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => start.mutate({ platform })}
        >
          New problem
        </Button>
      </div>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
