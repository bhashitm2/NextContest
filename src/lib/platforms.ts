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
  HACKERRANK: { label: "HackerRank", short: "HR", cssVar: "--cp-hr", logo: "hackerrank" },
  GEEKSFORGEEKS: { label: "GeeksforGeeks", short: "GfG", cssVar: "--cp-gfg", logo: "geeksforgeeks" },
  CODE360: { label: "Code360", short: "C360", cssVar: "--cp-c360", logo: null },
};

/** A `var(--cp-…)` color string for use in inline styles (theme-aware). */
export function platformColor(platform: Platform): string {
  return `var(${PLATFORM_META[platform].cssVar})`;
}

/** Platforms that have a contest feed — drives feed filters, follow-bar, and
 * subscriptions. (HackerRank reserved; profile-only platforms like TakeUForward
 * are intentionally excluded.) Append a platform here when its contest sync lands. */
export const CONTEST_PLATFORMS: Platform[] = [
  "CODEFORCES",
  "LEETCODE",
  "ATCODER",
  "CODECHEF",
];

/** Platforms with a connectable profile — drives the add-handle UI. Superset of
 * CONTEST_PLATFORMS plus profile-only platforms (no contest feed). Append here
 * when a platform's profile-sync fetchers land. */
export const PROFILE_PLATFORM_LIST: Platform[] = [
  ...CONTEST_PLATFORMS,
  "GEEKSFORGEEKS",
  "CODE360",
  "HACKERRANK",
];

/** @deprecated alias — use CONTEST_PLATFORMS. Kept to limit churn. */
export const ACTIVE_PLATFORMS = CONTEST_PLATFORMS;
