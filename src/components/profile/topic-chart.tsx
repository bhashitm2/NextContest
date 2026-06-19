import type { TagCount } from "@/lib/profile";

/** Horizontal bar chart of problems solved per topic tag (top `limit`). */
export function TopicChart({ data, limit = 12 }: { data: TagCount[]; limit?: number }) {
  const top = data.slice(0, limit);
  if (top.length === 0) return null;
  const max = Math.max(...top.map((d) => d.count), 1);

  return (
    <div className="space-y-1.5">
      {top.map((d) => (
        <div key={d.tag} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-right text-[12px] text-cp-dim" title={d.tag}>
            {d.tag}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-[5px] bg-cp-surface2">
            <div
              className="h-full rounded-[5px] bg-cp-accent"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <div className="w-10 shrink-0 font-mono text-[12px] text-cp-text">{d.count}</div>
        </div>
      ))}
    </div>
  );
}
