import Link from "next/link";

/** Branded 404 — shown for unmatched routes and any `notFound()` call. Renders
 * inside the root layout, so it keeps the site header/footer. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 py-24 text-center sm:px-[22px]">
      <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-cp-faint">404</p>
      <h1 className="mt-3 font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-cp-dim">
        That page doesn&apos;t exist or may have moved. Check the link, or head back to your contests.
      </p>
      <Link
        href="/contests"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-4 text-sm font-semibold text-cp-text transition-colors hover:border-cp-accent"
      >
        Back to contests
      </Link>
    </main>
  );
}
