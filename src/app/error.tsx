"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Branded route-segment error boundary. Renders inside the root layout (header/
 * footer kept). `unstable_retry` re-renders the failed segment (Next 16.2+). */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 py-24 text-center sm:px-[22px]">
      <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-cp-faint">Error</p>
      <h1 className="mt-3 font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-cp-dim">
        An unexpected error occurred. You can try again, or head back to your contests.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[12px] text-cp-faint">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-4 text-sm font-semibold text-cp-text transition-colors hover:border-cp-accent"
        >
          Try again
        </button>
        <Link
          href="/contests"
          className="inline-flex h-10 items-center px-2 text-sm font-semibold text-cp-dim transition-colors hover:text-cp-text"
        >
          Back to contests
        </Link>
      </div>
    </main>
  );
}
