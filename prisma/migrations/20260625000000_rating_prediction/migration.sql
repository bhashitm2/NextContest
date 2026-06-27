-- Rating Predictor (Codeforces + LeetCode): cache of predicted rating changes
-- plus a per-contest run log. Mirrors ContestResult (keyed by handle, additive).

-- CreateTable
CREATE TABLE "RatingPrediction" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "rank" INTEGER,
    "predictedDelta" INTEGER,
    "currentRating" INTEGER,
    "performance" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'live',
    "modelVersion" TEXT NOT NULL DEFAULT 'v1',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatingPrediction_platform_externalId_idx" ON "RatingPrediction"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingPrediction_platform_externalId_handle_key" ON "RatingPrediction"("platform", "externalId", "handle");

-- CreateTable
CREATE TABLE "PredictionRun" (
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "participantCount" INTEGER,
    "rated" BOOLEAN NOT NULL DEFAULT false,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionRun_pkey" PRIMARY KEY ("platform", "externalId")
);

-- Match the project's RLS posture (no Data API; Prisma over the postgres role
-- bypasses RLS). See 20260624000000_enable_rls.
ALTER TABLE "RatingPrediction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PredictionRun" ENABLE ROW LEVEL SECURITY;
