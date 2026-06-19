import type { Platform } from "@/generated/prisma/client";
import { platformColor, PLATFORM_META } from "@/lib/platforms";
import { totalSolved } from "@/lib/profile";

type Row = { platform: Platform; problemsSolved: number | null };

/** Hero strip: total problems solved + a clear per-platform "solved" breakdown. */
export function ProfileTotals({ handles }: { handles: Row[] }) {
  const total = totalSolved(handles);

  return (
    <div className="rounded-[16px] border border-cp-line bg-cp-surface p-5 sm:p-6">
      <div className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">
        Total problems solved
      </div>
      <div className="font-display text-[clamp(2.4rem,6vw,3.4rem)] font-bold leading-none tracking-tight text-cp-accent">
        {total.toLocaleString()}
      </div>
      <div className="mt-1 text-[12px] text-cp-dim">
        across {handles.length} {handles.length === 1 ? "platform" : "platforms"}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {handles.map((h) => (
          <div key={h.platform} className="rounded-[10px] border border-cp-line bg-cp-bg px-3 py-3">
            <div className="text-[12px] font-semibold" style={{ color: platformColor(h.platform) }}>
              {PLATFORM_META[h.platform].label}
            </div>
            <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-tight">
              {(h.problemsSolved ?? 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-cp-dim">problems solved</div>
          </div>
        ))}
      </div>
    </div>
  );
}
