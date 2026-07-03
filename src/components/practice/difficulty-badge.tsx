import { difficultyTier } from "@/lib/practice";

/** Easy / Medium / Hard chip, LeetCode-colored. */
export function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const tier = difficultyTier(difficulty);
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold"
      style={{
        color: tier.color,
        backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
      }}
    >
      {tier.label}
    </span>
  );
}
