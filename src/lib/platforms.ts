import type { Platform } from "@/generated/prisma/client";

export type PlatformMeta = {
  label: string;
  short: string;
  /** CSS variable holding the (theme-aware) brand color. */
  cssVar: string;
  /** Bundled brand-logo glyph in `public/logos/<logo>.svg` (null = none). */
  logo: string | null;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  CODEFORCES: { label: "Codeforces", short: "CF", cssVar: "--cp-cf", logo: "codeforces" },
  LEETCODE: { label: "LeetCode", short: "LC", cssVar: "--cp-lc", logo: "leetcode" },
  ATCODER: { label: "AtCoder", short: "AC", cssVar: "--cp-ac", logo: "atcoder" },
  CODECHEF: { label: "CodeChef", short: "CC", cssVar: "--cp-cc", logo: "codechef" },
  HACKERRANK: { label: "HackerRank", short: "HR", cssVar: "--cp-ac", logo: null },
};

/** A `var(--cp-…)` color string for use in inline styles (theme-aware). */
export function platformColor(platform: Platform): string {
  return `var(${PLATFORM_META[platform].cssVar})`;
}

/** Platforms exposed in the v0.1 feed/filter UI (HackerRank reserved for later). */
export const ACTIVE_PLATFORMS: Platform[] = ["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"];
