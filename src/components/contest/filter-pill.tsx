"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A multi-select platform filter pill (shared by the upcoming + past feeds). */
export function FilterPill({
  label,
  color,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  color?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  /** Leading glyph (e.g. a platform logo). Falls back to a color dot. */
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        !active && "border-cp-line text-cp-dim hover:bg-cp-surface",
      )}
      style={
        active
          ? {
              background: `color-mix(in srgb, ${color ?? "var(--cp-accent)"} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${color ?? "var(--cp-accent)"} 38%, transparent)`,
              color: color ?? "var(--cp-accent)",
            }
          : undefined
      }
    >
      {icon ?? (color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null)}
      {label}
      {typeof count === "number" ? (
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      ) : null}
    </button>
  );
}
