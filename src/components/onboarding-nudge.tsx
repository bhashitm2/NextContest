"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "nc-onboarding-handles-dismissed";

// Read-once external store: server snapshot is `false` (not dismissed) so SSR and
// the first client render match; the client snapshot reflects localStorage.
const noopSubscribe = () => () => {};
function usePreviouslyDismissed() {
  return useSyncExternalStore(
    noopSubscribe,
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => false,
  );
}

/**
 * First-run nudge shown to signed-in users who haven't connected any handle yet.
 * Rendered only when the server already knows the user has zero verified handles;
 * this just adds client-side dismissal that sticks across visits.
 */
export function OnboardingNudge() {
  const previouslyDismissed = usePreviouslyDismissed();
  const [dismissed, setDismissed] = useState(false);

  if (previouslyDismissed || dismissed) return null;

  return (
    <div
      className="relative mb-6 flex flex-wrap items-center gap-4 rounded-[16px] border border-cp-line bg-cp-surface p-4 sm:p-5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--cp-accent) 8%, transparent), transparent), var(--cp-surface)",
      }}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl text-cp-accent"
        style={{ background: "color-mix(in srgb, var(--cp-accent) 14%, transparent)" }}
      >
        <Sparkles className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[15px] font-bold text-cp-text">Finish setting up</h2>
        <p className="mt-0.5 text-[13.5px] text-cp-dim">
          Connect your coding handles to unlock your profile, cross-platform stats and a rating
          forecast.
        </p>
      </div>
      <Link
        href="/settings"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-cp-accent px-4 text-[13px] font-semibold text-cp-accent-ink"
      >
        Connect handles
        <span aria-hidden>→</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-cp-faint transition-colors hover:text-cp-text"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
