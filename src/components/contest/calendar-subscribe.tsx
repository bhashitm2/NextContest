"use client";

import { CalendarClock, Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function CalendarSubscribe() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Only mint the token / fetch the URL once the user opens this section.
  const sub = api.calendar.subscription.useQuery(undefined, { enabled: open });

  const copy = async () => {
    if (!sub.data) return;
    try {
      await navigator.clipboard.writeText(sub.data.httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-cp-line bg-cp-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <CalendarClock className="size-4 shrink-0 text-cp-accent" />
        <span className="text-sm font-semibold text-cp-text">Subscribe in your calendar</span>
        <span className="hidden text-[13px] text-cp-faint sm:inline">
          — followed contests appear automatically, with an alarm before each one
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-cp-dim transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-cp-line px-4 py-3.5">
          {sub.isLoading ? (
            <p className="text-[13px] text-cp-dim">Preparing your feed…</p>
          ) : sub.data ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <a
                  href={sub.data.webcalUrl}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-cp-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <CalendarClock className="size-[15px]" />
                  Subscribe (Apple / Outlook)
                </a>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 py-2 text-[13px] font-semibold text-cp-dim transition-colors hover:text-cp-text"
                >
                  {copied ? (
                    <Check className="size-[15px] text-cp-accent" />
                  ) : (
                    <Copy className="size-[15px]" />
                  )}
                  {copied ? "Copied!" : "Copy feed URL"}
                </button>
              </div>

              <p className="text-[12.5px] leading-relaxed text-cp-faint">
                <span className="text-cp-dim">Google Calendar:</span> open{" "}
                <span className="text-cp-dim">Other calendars → + → From URL</span>, then paste:
              </p>
              <code className="block w-full overflow-x-auto whitespace-nowrap rounded-md border border-cp-line bg-cp-bg px-2.5 py-2 font-mono text-[12px] text-cp-dim">
                {sub.data.httpsUrl}
              </code>
            </div>
          ) : (
            <p className="text-[13px] text-cp-dim">Couldn’t load your feed. Try again.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
