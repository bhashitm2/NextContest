"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const PUBLIC_ITEMS: NavItem[] = [
  { href: "/contests", label: "Contests" },
  { href: "/practice", label: "Practice" },
  { href: "/ratings", label: "Ratings" },
];

const AUTHED_ITEMS: NavItem[] = [
  { href: "/friends", label: "Friends" },
  { href: "/duels", label: "Duels" },
  { href: "/profile", label: "Profile" },
];

/** Highlight a section for its own route and any nested route under it. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop primary navigation. Renders the active-section indicator from the
 * current pathname and pending-count badges (friend requests on Friends,
 * incoming challenges on Duels). Hidden below `sm` — `MobileNav` covers small
 * screens.
 */
export function MainNav({
  isAuthed,
  pendingRequests,
  pendingDuels = 0,
}: {
  isAuthed: boolean;
  pendingRequests: number;
  pendingDuels?: number;
}) {
  const isActive = useIsActive();
  const items = isAuthed ? [...PUBLIC_ITEMS, ...AUTHED_ITEMS] : PUBLIC_ITEMS;
  const badges: Record<string, { count: number; label: string }> = {
    "/friends": { count: pendingRequests, label: "friend request" },
    "/duels": { count: pendingDuels, label: "duel challenge" },
  };

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const active = isActive(item.href);
        const badge = badges[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "text-cp-text" : "text-cp-dim hover:text-cp-text"
            }`}
          >
            {item.label}
            {badge && badge.count > 0 ? (
              <span
                title={`${badge.count} ${badge.label}${badge.count > 1 ? "s" : ""}`}
                className="absolute -right-0.5 top-0.5 grid min-w-[16px] place-items-center rounded-full bg-cp-accent px-1 text-[10px] font-bold leading-4 text-cp-accent-ink"
              >
                {badge.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-cp-accent" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
