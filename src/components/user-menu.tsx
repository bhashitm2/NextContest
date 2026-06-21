"use client";

import { ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Avatar + name trigger that opens a dropdown with Settings + Sign out. */
export function UserMenu({
  name,
  initial,
  signOutAction,
}: {
  name: string;
  initial: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className="flex items-center gap-2 rounded-[10px] border border-transparent px-1 py-1 transition-colors hover:border-cp-line hover:bg-cp-surface"
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-cp-accent-ink"
          style={{ background: "var(--cp-accent)" }}
        >
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm text-cp-dim sm:inline">{name}</span>
        <ChevronDown
          className={`hidden size-4 text-cp-faint transition-transform sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-[12px] border border-cp-line-strong p-1 backdrop-blur-xl"
          style={{
            // Frosted-glass panel: high-opacity surface over a backdrop blur so it
            // reads as opaque glass, not see-through (cp-surface alone is ~3% alpha).
            background: "color-mix(in srgb, var(--cp-bg-soft) 92%, transparent)",
            boxShadow: "0 10px 34px rgba(0,0,0,0.45)",
          }}
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm text-cp-text transition-colors hover:bg-cp-bg"
          >
            <Settings className="size-4 text-cp-dim" /> Settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-sm text-cp-text transition-colors hover:bg-cp-bg"
            >
              <LogOut className="size-4 text-cp-dim" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
