import type { CSSProperties } from "react";

import type { Platform } from "@/generated/prisma/client";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/**
 * Brand-logo glyph for a platform, tinted to a solid color via a CSS mask (so
 * the monochrome SVG in `public/logos/` takes the platform's theme color and
 * works in both light/dark). Falls back to the short text label if no logo.
 */
export function PlatformLogo({
  platform,
  size = 16,
  color,
  className,
}: {
  platform: Platform;
  size?: number;
  color?: string;
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  const tint = color ?? platformColor(platform);

  if (!meta.logo) {
    return (
      <span
        aria-hidden
        className={cn("inline-grid place-items-center font-mono font-bold leading-none", className)}
        style={{ width: size, height: size, fontSize: size * 0.62, color: tint }}
      >
        {meta.short}
      </span>
    );
  }

  const url = `/logos/${meta.logo}.svg`;
  const mask: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: tint,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
  return <span aria-hidden className={cn("inline-block shrink-0", className)} style={mask} />;
}
