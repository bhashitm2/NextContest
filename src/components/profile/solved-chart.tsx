import { formatMonth, type SolvedMonth } from "@/lib/profile";

/** Lightweight CSS bar chart of problems solved per month (last `months`). */
export function SolvedChart({ data, months = 12 }: { data: SolvedMonth[]; months?: number }) {
  const recent = data.slice(-months);
  if (recent.length === 0) return null;
  const max = Math.max(...recent.map((d) => d.count), 1);

  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {recent.map((d) => (
          <div key={d.month} className="group/bar flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-mono text-[10px] text-cp-dim opacity-0 transition-opacity group-hover/bar:opacity-100">
              {d.count}
            </span>
            <div
              className="w-full rounded-t-[3px] bg-cp-accent transition-all"
              style={{ height: `${Math.max((d.count / max) * 100, 3)}%` }}
              title={`${formatMonth(d.month)}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-cp-faint">
        <span>{formatMonth(recent[0].month)}</span>
        {recent.length > 1 ? <span>{formatMonth(recent[recent.length - 1].month)}</span> : null}
      </div>
    </div>
  );
}
