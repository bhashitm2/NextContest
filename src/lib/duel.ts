// Duel presets + format metadata, shared by the create form and the server
// (the server derives counts/durations from these — never from client numbers).

export const DUEL_PRESETS = {
  QUICK: { label: "Quick", problemCount: 3, durationSec: 30 * 60 },
  STANDARD: { label: "Standard", problemCount: 5, durationSec: 60 * 60 },
  MARATHON: { label: "Marathon", problemCount: 7, durationSec: 120 * 60 },
} as const;

export type DuelPreset = keyof typeof DUEL_PRESETS;

export const DUEL_FORMATS = {
  TIMED: {
    label: "Timed",
    blurb: "Most solves when the clock runs out. Ties break on total solve time.",
  },
  FIRST_SOLVE: {
    label: "First solve",
    blurb: "First accepted submission on any problem wins instantly.",
  },
  RACE: {
    label: "Race",
    blurb: "First to solve every problem wins — can end before the clock.",
  },
} as const;

export type DuelFormatKey = keyof typeof DUEL_FORMATS;

export const RATING_MIN = 800;
export const RATING_MAX = 3500;

/** winTarget encodes the early-finish rule: null = play out the clock. */
export function winTargetFor(format: DuelFormatKey, problemCount: number): number | null {
  if (format === "FIRST_SOLVE") return 1;
  if (format === "RACE") return problemCount;
  return null;
}

/** Suggested rating band from the two players' CF ratings (form default). */
export function suggestedBand(myRating: number | null, theirRating: number | null): {
  min: number;
  max: number;
} {
  const known = [myRating, theirRating].filter((r): r is number => r != null);
  if (known.length === 0) return { min: 800, max: 1200 };
  const mid = Math.round(known.reduce((s, r) => s + r, 0) / known.length / 100) * 100;
  const min = Math.min(Math.max(mid - 100, RATING_MIN), RATING_MAX - 100);
  return { min, max: Math.min(min + 300, RATING_MAX) };
}

/** How long an unanswered invite stays actionable. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/** Canonical join URL for an open-duel invite token. */
export function joinUrlFor(base: string, token: string): string {
  return `${base}/duels/join/${token}`;
}
