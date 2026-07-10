import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { DUEL_FORMATS, type DuelFormatKey } from "@/lib/duel";
import { parseProblems, scoreOf } from "@/server/duel/judge";

export const dynamic = "force-dynamic";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0e14";
const SURFACE = "#141a26";
const LINE = "#232c3d";
const TEXT = "#e8ecf4";
const DIM = "#8b95a8";
const ACCENT = "#6366f1"; // challenger side (theme accent fallback)
const AMBER = "#f59e0b"; // opponent side, mirroring duel-cast

function Generic() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
        color: TEXT,
        gap: 18,
      }}
    >
      <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>⚔️ Problem Duel</div>
      <div style={{ display: "flex", fontSize: 30, color: DIM }}>
        1v1 Codeforces battles — NextContest
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const duel = await prisma.duel
    .findUnique({
      where: { id },
      select: {
        status: true,
        format: true,
        problemCount: true,
        startedAt: true,
        problems: true,
        draw: true,
        winnerId: true,
        challengerId: true,
        challengerHandle: true,
        opponentHandle: true,
      },
    })
    .catch(() => null);

  // Only FINISHED duels get a real card — anything else renders generic
  // branding so a shared in-progress link leaks nothing.
  if (!duel || duel.status !== "FINISHED" || !duel.startedAt) {
    return new ImageResponse(<Generic />, size);
  }

  const problems = parseProblems(duel.problems);
  const a = scoreOf(problems, duel.startedAt, "A").solved;
  const b = scoreOf(problems, duel.startedAt, "B").solved;
  const winnerA = !duel.draw && duel.winnerId === duel.challengerId;
  const winnerB = !duel.draw && duel.winnerId != null && !winnerA;
  const format = DUEL_FORMATS[duel.format as DuelFormatKey]?.label ?? duel.format;

  const side = (handle: string | null, color: string, won: boolean) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        width: 420,
      }}
    >
      <div style={{ display: "flex", fontSize: 34, height: 44 }}>{won ? "👑" : " "}</div>
      <div
        style={{
          display: "flex",
          fontSize: 44,
          fontWeight: 700,
          color,
          maxWidth: 420,
          overflow: "hidden",
        }}
      >
        {handle ?? "?"}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          color: TEXT,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: DIM, marginBottom: 34 }}>
          ⚔️ NextContest Duels
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            background: SURFACE,
            border: `2px solid ${LINE}`,
            borderRadius: 28,
            padding: "44px 40px",
          }}
        >
          {side(duel.challengerHandle, ACCENT, winnerA)}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 96,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", color: winnerA ? ACCENT : TEXT }}>{a}</div>
            <div style={{ display: "flex", color: DIM, fontSize: 64 }}>–</div>
            <div style={{ display: "flex", color: winnerB ? AMBER : TEXT }}>{b}</div>
          </div>
          {side(duel.opponentHandle, AMBER, winnerB)}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: DIM, marginTop: 34 }}>
          {duel.draw ? "Draw · " : ""}
          {format} duel · {duel.problemCount} problems · Codeforces
        </div>
      </div>
    ),
    size,
  );
}
