import type { DifficultyBreakdown } from "@/lib/profile";

const SEGMENTS: { key: keyof DifficultyBreakdown; label: string; color: string }[] = [
  { key: "easy", label: "Easy", color: "#22c55e" },
  { key: "medium", label: "Medium", color: "#f59e0b" },
  { key: "hard", label: "Hard", color: "#ef4444" },
];

/** Stacked easy/medium/hard bar with a legend. */
export function DifficultyBar({ data }: { data: DifficultyBreakdown }) {
  const total = data.easy + data.medium + data.hard;
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-cp-surface2">
        {SEGMENTS.map((s) =>
          data[s.key] > 0 ? (
            <div
              key={s.key}
              style={{ width: `${(data[s.key] / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${data[s.key]}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-cp-dim">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="font-mono text-cp-text">{data[s.key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
