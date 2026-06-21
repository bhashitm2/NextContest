-- CreateTable
CREATE TABLE "ContestResult" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "rank" INTEGER,
    "ratingBefore" INTEGER,
    "ratingAfter" INTEGER,
    "ratingDelta" INTEGER,
    "problemsSolved" INTEGER,
    "performance" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContestResult_platform_externalId_idx" ON "ContestResult"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestResult_platform_externalId_handle_key" ON "ContestResult"("platform", "externalId", "handle");
