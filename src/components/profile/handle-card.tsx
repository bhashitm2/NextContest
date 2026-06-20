"use client";

import { BadgeCheck, Check, Copy, ExternalLink, Loader2, RefreshCw, ShieldQuestion, Trash2 } from "lucide-react";
import { useState } from "react";

import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { type HandleView, platformProfileUrl, VERIFICATION_FIELD } from "@/lib/profile";
import { PLATFORM_META } from "@/lib/platforms";
import { api } from "@/trpc/react";

import { PlatformChip } from "./platform-chip";
import { SubmissionVerify } from "./submission-verify";

type HandleRow = HandleView & { verified: boolean; verificationCode: string | null };

type PlatformArg = "CODEFORCES" | "LEETCODE" | "ATCODER" | "CODECHEF";

export function HandleCard({ handle }: { handle: HandleRow }) {
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const platform = handle.platform as PlatformArg;
  const label = PLATFORM_META[handle.platform].label;
  const supportsSubmission = platform === "CODEFORCES" || platform === "ATCODER";
  const [method, setMethod] = useState<"submission" | "field">(
    supportsSubmission ? "submission" : "field",
  );

  const onError = (e: { message: string }) => setError(e.message);
  const invalidate = () => {
    setError(null);
    utils.handle.list.invalidate();
  };

  const verify = api.handle.verify.useMutation({ onSuccess: invalidate, onError });
  const refresh = api.handle.refresh.useMutation({ onSuccess: invalidate, onError });
  const remove = api.handle.remove.useMutation({ onSuccess: invalidate, onError });
  const busy = verify.isPending || refresh.isPending || remove.isPending;

  return (
    <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformChip platform={handle.platform} />
        <a
          href={platformProfileUrl(handle.platform, handle.handle)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[14px] font-semibold text-cp-text hover:text-cp-accent"
        >
          {handle.handle}
          <ExternalLink className="size-3.5 opacity-60" />
        </a>
        {handle.verified ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-500">
            <BadgeCheck className="size-4" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-500">
            <ShieldQuestion className="size-4" /> Unverified
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {handle.verified ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => refresh.mutate({ platform })}
              title="Refresh stats"
            >
              {refresh.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refresh
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => remove.mutate({ platform })}
            title="Disconnect handle"
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </div>

      {handle.verified ? (
        <p className="mt-2 font-mono text-[11px] text-cp-faint">
          {handle.lastSynced ? (
            <>
              Last synced <LocalDate date={new Date(handle.lastSynced)} /> · view full stats on your
              profile page
            </>
          ) : (
            "No stats yet — hit Refresh to load them."
          )}
        </p>
      ) : (
        <div className="mt-3 space-y-3 rounded-[10px] border border-amber-500/30 bg-amber-500/5 p-3">
          {supportsSubmission ? (
            <div className="flex gap-1.5">
              {(["submission", "field"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    method === m
                      ? "bg-cp-accent text-cp-accent-ink"
                      : "text-cp-dim hover:text-cp-text"
                  }`}
                >
                  {m === "submission" ? "Compile error (faster)" : "Paste a code"}
                </button>
              ))}
            </div>
          ) : null}

          {supportsSubmission && method === "submission" ? (
            <SubmissionVerify platform={platform as "CODEFORCES" | "ATCODER"} label={label} />
          ) : (
            <>
              <p className="text-[13px] text-cp-dim">
                Paste this code into your <span className="font-semibold text-cp-text">
                  {VERIFICATION_FIELD[handle.platform]}</span> on {label}, save it, then click Verify.
              </p>
              <div className="flex items-center gap-2 rounded-[8px] border border-cp-line bg-cp-bg px-3 py-2">
                <code className="flex-1 truncate font-mono text-[13px] text-cp-accent">
                  {handle.verificationCode}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!handle.verificationCode) return;
                    navigator.clipboard.writeText(handle.verificationCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={busy} onClick={() => verify.mutate({ platform })}>
                  {verify.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
                  Verify
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <a href={platformProfileUrl(handle.platform, handle.handle)} target="_blank" rel="noreferrer" />
                  }
                >
                  <ExternalLink />
                  Open {label}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
