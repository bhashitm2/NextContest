-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DuelFormat" AS ENUM ('TIMED', 'FIRST_SOLVE', 'RACE');

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'CODEFORCES',
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PENDING',
    "format" "DuelFormat" NOT NULL,
    "problemCount" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "winTarget" INTEGER,
    "ratingMin" INTEGER NOT NULL,
    "ratingMax" INTEGER NOT NULL,
    "challengerHandle" TEXT,
    "opponentHandle" TEXT,
    "problems" JSONB,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "draw" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duel_challengerId_status_idx" ON "Duel"("challengerId", "status");

-- CreateIndex
CREATE INDEX "Duel_opponentId_status_idx" ON "Duel"("opponentId", "status");

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security posture: RLS on every public table (no policies — the app is
-- Prisma-only over the postgres role; the Supabase Data API roles get nothing).
ALTER TABLE "Duel" ENABLE ROW LEVEL SECURITY;
