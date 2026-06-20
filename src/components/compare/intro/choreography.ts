// Single source of truth for the boxing cinematic's timeline (in seconds from
// scene mount). The R3F scene animates against these; compare-stage uses the
// derived millisecond marks to time the DOM winner reveal + auto-dismiss.

export const T = {
  /** Ring fades in, camera dollies toward the fighters. */
  introEnd: 1.0,
  /** Camera arcs to a side profile; fighters square up. */
  faceoffEnd: 2.0,
  /** Traded jabs build tension. */
  exchangeEnd: 5.0,
  /** Finishing blow lands (KO) / fighters break (tie). */
  koImpact: 5.7,
  /** Loser has hit the canvas. */
  koEnd: 6.4,
  /** Winner holds the victory pose; scene then idles. */
  victoryEnd: 7.6,
} as const;

/** When the DOM "WINNER" reveal fades in — just after the KO lands. */
export const REVEAL_AT_MS = Math.round(T.koImpact * 1000) + 250;
/** When the cinematic auto-dismisses to the stat breakdown (unless skipped). */
export const AUTODISMISS_MS = REVEAL_AT_MS + 3800;

/** Punch beats during the exchange: [time, who throws]. Winner lands the cleaner ones. */
export const PUNCH_BEATS: { t: number; side: "a" | "b" }[] = [
  { t: 2.4, side: "a" },
  { t: 2.95, side: "b" },
  { t: 3.5, side: "a" },
  { t: 4.05, side: "b" },
  { t: 4.55, side: "a" },
];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smooth 0→1 ramp over [a, b]. */
export const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** Ease in-out cubic. */
export const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** A 0→1→0 pulse over [start, start+dur] (for a punch extend+retract). */
export function pulse(t: number, start: number, dur: number): number {
  const p = (t - start) / dur;
  if (p <= 0 || p >= 1) return 0;
  return Math.sin(p * Math.PI);
}
