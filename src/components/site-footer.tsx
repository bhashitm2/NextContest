export function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-5 border-t border-cp-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[13px] text-cp-faint sm:px-[22px]">
        <span className="font-mono">NextContest · synced from 4 platforms</span>
        <span className="inline-flex items-center gap-[7px]">
          <span
            className="size-1.5 rounded-full bg-cp-accent"
            style={{ animation: "livePulse 1.8s ease-in-out infinite" }}
          />
          All systems operational
        </span>
      </div>
    </footer>
  );
}
