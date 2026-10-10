import Link from "next/link";

/** Crawlable links to the public surfaces. A footer nav is a cheap way to keep
 * every top-level page one hop from any other, which matters most for pages a
 * signed-out crawler can reach (the header nav hides the authed links). */
const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: "/contests", label: "Upcoming contests" },
  { href: "/contests/past", label: "Past contests" },
  { href: "/practice", label: "Practice problems" },
  { href: "/ratings", label: "Rating lookup" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-5 border-t border-cp-line">
      <div className="mx-auto max-w-[1240px] px-4 py-6 text-[13px] text-cp-faint sm:px-[22px]">
        <nav aria-label="Footer" className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-cp-text">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono">NextContest · synced from 4 platforms</span>
          <span className="inline-flex items-center gap-[7px]">
            <span
              className="size-1.5 rounded-full bg-cp-accent"
              style={{ animation: "livePulse 1.8s ease-in-out infinite" }}
            />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
