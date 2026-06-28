/**
 * Shown in the content slot while a tab's data loads, so switching to Past (a
 * server fetch) feels instant — the header + sliding tabs stay put above it.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-5 w-64 animate-pulse rounded bg-cp-surface2" />
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[260px] animate-pulse rounded-2xl border border-cp-line bg-cp-surface"
          />
        ))}
      </div>
    </div>
  );
}
