import type { Platform } from "@/generated/prisma/client";

/**
 * A representative hex color for a platform rank/tier string, matching each
 * platform's own color convention (CF rank colors, AtCoder tier colors,
 * CodeChef star colors, LeetCode badges). Returns null when unknown — callers
 * fall back to the default text color. Platforms don't publish downloadable
 * rank-badge images; ranks are color tiers, so we render colored text instead.
 */
export function rankColor(platform: Platform, rank: string | null | undefined): string | null {
  if (!rank) return null;
  const r = rank.toLowerCase();

  switch (platform) {
    case "CODEFORCES":
      if (r.includes("legendary")) return "#FF0000";
      if (r.includes("grandmaster")) return "#FF0000"; // incl. international grandmaster
      if (r.includes("master")) return "#FF8C00"; // incl. international master
      if (r.includes("candidate")) return "#AA00AA";
      if (r.includes("expert")) return "#0000FF";
      if (r.includes("specialist")) return "#03A89E";
      if (r.includes("pupil")) return "#008000";
      if (r.includes("newbie")) return "#808080";
      return null;

    case "ATCODER": {
      if (r.includes("red")) return "#FF0000";
      if (r.includes("orange")) return "#FF8000";
      if (r.includes("yellow")) return "#C0C000";
      if (r.includes("blue")) return "#0000FF";
      if (r.includes("cyan")) return "#00C0C0";
      if (r.includes("green")) return "#008000";
      if (r.includes("brown")) return "#804000";
      if (r.includes("gray") || r.includes("grey")) return "#808080";
      if (/\ddan/.test(r)) return "#FF8000"; // Dan ranks are strong (orange+)
      const kyu = r.match(/(\d+)\s*kyu/);
      if (kyu) {
        const n = Number(kyu[1]); // smaller kyu number = stronger
        if (n <= 1) return "#0000FF";
        if (n <= 3) return "#00C0C0";
        if (n <= 5) return "#008000";
        if (n <= 7) return "#804000";
        return "#808080";
      }
      return null;
    }

    case "CODECHEF": {
      const m = r.match(/(\d)\s*(?:★|star)/);
      const n = m ? Number(m[1]) : NaN;
      if (n >= 7) return "#D0011B";
      if (n === 6) return "#FF7F00";
      if (n === 5) return "#FFBF00";
      if (n === 4) return "#9933FF";
      if (n === 3) return "#3366CC";
      if (n === 2) return "#1E7D22";
      if (n === 1) return "#666666";
      return null;
    }

    case "LEETCODE":
      if (r.includes("guardian")) return "#F5A623"; // gold
      if (r.includes("knight")) return "#5B8FF9"; // blue
      return null;

    default:
      return null;
  }
}
