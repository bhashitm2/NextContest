import type { ReactNode } from "react";

/**
 * Shared page header so every top-level page shares one title/subtitle rhythm
 * instead of re-deriving the same `font-display clamp(...)` markup by hand.
 *
 * - `badge`  renders inline after the title (e.g. a LIVE chip).
 * - `action` is pushed to the right of the title row (e.g. a link button).
 * - `tabs`   renders below the title row (e.g. the Contests segmented control).
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  action,
  tabs,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
          {title}
        </h1>
        {badge}
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      {subtitle ? <p className="mt-2 text-[15px] text-cp-dim">{subtitle}</p> : null}
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </header>
  );
}
