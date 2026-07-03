import type { BoxingCast } from "@/lib/compare-cast";

// Side colors mirror the compare cinematic: challenger = theme accent (with a
// concrete hex fallback for WebGL materials), opponent = amber.
const ACCENT_CSS = "var(--cp-accent)";
const ACCENT_HEX_FALLBACK = "#6366f1";
const OPPONENT_COLOR = "#f59e0b";

type DuelPlayer = { username: string | null; name: string | null; image: string | null };

/** Map a finished duel to the boxing cinematic's cast. a = challenger. */
export function toDuelCast(duel: {
  challenger: DuelPlayer;
  opponent: DuelPlayer;
  challengerId: string;
  winnerId: string | null;
  draw: boolean;
  scores: { a: { solved: number }; b: { solved: number } };
}): BoxingCast {
  return {
    a: {
      name: duel.challenger.name ?? duel.challenger.username ?? "Challenger",
      colorCss: ACCENT_CSS,
      colorHex: ACCENT_HEX_FALLBACK,
      avatar: duel.challenger.image,
    },
    b: {
      name: duel.opponent.name ?? duel.opponent.username ?? "Opponent",
      colorCss: OPPONENT_COLOR,
      colorHex: OPPONENT_COLOR,
      avatar: duel.opponent.image,
    },
    winner: duel.draw || !duel.winnerId ? "tie" : duel.winnerId === duel.challengerId ? "a" : "b",
    aScore: duel.scores.a.solved,
    bScore: duel.scores.b.solved,
  };
}
