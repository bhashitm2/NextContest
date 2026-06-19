import type { Platform } from "@/generated/prisma/client";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Small brand-colored platform pill. */
export function PlatformChip({ platform, className }: { platform: Platform; className?: string }) {
  const color = platformColor(platform);
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold", className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {PLATFORM_META[platform].label}
    </span>
  );
}
