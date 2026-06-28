"use client";

import { LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavItem = { href: string; label: string };

const PUBLIC_ITEMS: NavItem[] = [
  { href: "/contests", label: "Contests" },
  { href: "/ratings", label: "Ratings" },
];

const AUTHED_ITEMS: NavItem[] = [
  { href: "/friends", label: "Friends" },
  { href: "/profile", label: "Profile" },
];

/**
 * Small-screen navigation. The desktop nav links are `hidden sm:*`, so without
 * this a signed-in user on a phone has no way to reach Contests/Friends/etc.
 * A hamburger opens a frosted drawer with every primary destination.
 */
export function MobileNav({
  isAuthed,
  pendingRequests,
  signOutAction,
}: {
  isAuthed: boolean;
  pendingRequests: number;
  signOutAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const items = isAuthed ? [...PUBLIC_ITEMS, ...AUTHED_ITEMS] : PUBLIC_ITEMS;

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-[10px] border border-cp-line text-cp-dim transition-colors hover:text-cp-text"
      >
        <Menu className="size-5" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        // Portal to <body>: the site header has a `backdrop-blur`, which creates
        // a containing block that would otherwise trap this fixed overlay inside
        // the 64px-tall header instead of covering the viewport.
        <div className="fixed inset-0 z-[100]">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          {/* panel */}
          <div
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-[78%] max-w-[320px] flex-col gap-1 border-l border-cp-line-strong p-3 backdrop-blur-xl"
            style={{
              background: "color-mix(in srgb, var(--cp-bg-soft) 94%, transparent)",
              boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <span className="font-display text-[15px] font-bold text-cp-text">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center rounded-lg text-cp-dim transition-colors hover:text-cp-text"
              >
                <X className="size-5" />
              </button>
            </div>

            {items.map((item) => {
              const active = isActive(item.href);
              const isFriends = item.href === "/friends";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-[10px] px-3 py-2.5 text-[15px] transition-colors ${
                    active
                      ? "bg-cp-surface font-semibold text-cp-text"
                      : "text-cp-dim hover:bg-cp-surface hover:text-cp-text"
                  }`}
                >
                  <span>{item.label}</span>
                  {isFriends && pendingRequests > 0 ? (
                    <span className="grid min-w-[18px] place-items-center rounded-full bg-cp-accent px-1 text-[11px] font-bold leading-5 text-cp-accent-ink">
                      {pendingRequests}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {isAuthed ? (
              <>
                <div className="my-1 border-t border-cp-line" />
                <Link
                  href="/settings"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[15px] text-cp-dim transition-colors hover:bg-cp-surface hover:text-cp-text"
                >
                  <Settings className="size-[18px]" /> Settings
                </Link>
                {signOutAction ? (
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[15px] text-cp-dim transition-colors hover:bg-cp-surface hover:text-cp-text"
                    >
                      <LogOut className="size-[18px]" /> Sign out
                    </button>
                  </form>
                ) : null}
              </>
            ) : null}
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
