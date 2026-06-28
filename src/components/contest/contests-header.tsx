"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Persistent Contests header (rendered once by the (browse) layout, so it does
 * NOT re-mount when switching tabs). Because it stays mounted, the active
 * indicator can physically slide between Upcoming and Past, and the badge /
 * subtitle update reactively from the pathname.
 */
export function ContestsHeader() {
  const pathname = usePathname();
  const isPast = pathname === "/contests/past";

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
          Contests
        </h1>
        {!isPast ? (
          <span
            className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 font-mono text-[11px] text-cp-accent"
            style={{
              background: "color-mix(in srgb, var(--cp-accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cp-accent) 35%, transparent)",
            }}
          >
            <span
              className="size-1.5 rounded-full bg-cp-accent"
              style={{ animation: "livePulse 1.6s ease-in-out infinite" }}
            />
            LIVE
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[15px] text-cp-dim">
        {isPast
          ? "Recently finished rounds. Pick one to compare your rank & rating change head-to-head with a friend who also competed."
          : "Every upcoming round across Codeforces, LeetCode, AtCoder & CodeChef — in one place."}
      </p>

      {/* Sliding segmented control. The indicator translates by exactly one tab
          width; the two tabs are fixed-width so the geometry stays exact. */}
      <div className="mt-4 relative inline-flex rounded-[12px] border border-cp-line bg-cp-surface p-1">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 w-[104px] rounded-[9px] bg-cp-accent transition-transform duration-300 ease-out"
          style={{ transform: isPast ? "translateX(104px)" : "translateX(0)" }}
        />
        <Link
          href="/contests"
          aria-current={!isPast ? "page" : undefined}
          className={`relative z-10 w-[104px] rounded-[9px] py-1.5 text-center text-[13.5px] font-semibold transition-colors ${
            !isPast ? "text-cp-accent-ink" : "text-cp-dim hover:text-cp-text"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/contests/past"
          aria-current={isPast ? "page" : undefined}
          className={`relative z-10 w-[104px] rounded-[9px] py-1.5 text-center text-[13.5px] font-semibold transition-colors ${
            isPast ? "text-cp-accent-ink" : "text-cp-dim hover:text-cp-text"
          }`}
        >
          Past
        </Link>
      </div>
    </header>
  );
}
