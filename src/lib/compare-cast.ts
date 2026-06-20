import type { CompareResult, Winner } from "@/lib/compare";

/** One competitor as the boxing cinematic needs them. */
export type BoxingFighter = {
  name: string;
  /** CSS color for DOM use (may be a `var(--…)` expression). */
  colorCss: string;
  /** Concrete hex used for WebGL materials when a CSS var can't resolve. */
  colorHex: string;
  avatar: string | null;
};

/** Everything the scene + reveal need, derived purely from the comparison. */
export type BoxingCast = {
  a: BoxingFighter;
  b: BoxingFighter;
  winner: Winner;
  aScore: number;
  bScore: number;
};

// Side colors mirror VsView: you = the theme accent, friend = amber. The accent
// is a CSS var (theme/accent-picker driven) so we also carry a concrete hex the
// WebGL layer can fall back to when getComputedStyle can't resolve the var.
const ACCENT_CSS = "var(--cp-accent)";
const ACCENT_HEX_FALLBACK = "#6366f1";
const FRIEND_COLOR = "#f59e0b";

function nameOf(
  side: CompareResult["a"],
  fallback: string,
): string {
  return side.name ?? side.username ?? fallback;
}

/** Map a finished comparison to the cinematic cast (names, colors, avatars). */
export function toBoxingCast(result: CompareResult): BoxingCast {
  return {
    a: {
      name: nameOf(result.a, "You"),
      colorCss: ACCENT_CSS,
      colorHex: ACCENT_HEX_FALLBACK,
      avatar: result.a.image,
    },
    b: {
      name: nameOf(result.b, "Friend"),
      colorCss: FRIEND_COLOR,
      colorHex: FRIEND_COLOR,
      avatar: result.b.image,
    },
    winner: result.overall.winner,
    aScore: result.overall.aScore,
    bScore: result.overall.bScore,
  };
}

/** The winning fighter (or null on a tie), for reveal/choreography convenience. */
export function castWinner(cast: BoxingCast): BoxingFighter | null {
  if (cast.winner === "a") return cast.a;
  if (cast.winner === "b") return cast.b;
  return null;
}

export type { Winner };
