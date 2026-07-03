-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "JudgeLanguage" AS ENUM ('PYTHON', 'CPP', 'JAVA');

-- CreateEnum
CREATE TYPE "JudgeVerdict" AS ENUM ('AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'JUDGE_ERROR');

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statementMd" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "tags" TEXT[],
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryMb" INTEGER NOT NULL DEFAULT 256,
    "status" "ProblemStatus" NOT NULL DEFAULT 'DRAFT',
    "ord" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemTest" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProblemTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "language" "JudgeLanguage" NOT NULL,
    "source" TEXT NOT NULL,
    "verdict" "JudgeVerdict" NOT NULL,
    "passedCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "timeMs" INTEGER,
    "compileOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE INDEX "Problem_status_difficulty_idx" ON "Problem"("status", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemTest_problemId_ord_key" ON "ProblemTest"("problemId", "ord");

-- CreateIndex
CREATE INDEX "JudgeSubmission_userId_problemId_createdAt_idx" ON "JudgeSubmission"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "JudgeSubmission_problemId_verdict_idx" ON "JudgeSubmission"("problemId", "verdict");

-- AddForeignKey
ALTER TABLE "ProblemTest" ADD CONSTRAINT "ProblemTest_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security posture: RLS on every public table (no policies — the app is
-- Prisma-only over the postgres role; the Supabase Data API roles get nothing).
ALTER TABLE "Problem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProblemTest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JudgeSubmission" ENABLE ROW LEVEL SECURITY;
