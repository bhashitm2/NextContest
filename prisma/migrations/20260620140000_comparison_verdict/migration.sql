-- CreateTable
CREATE TABLE "ComparisonVerdict" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "statsHash" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonVerdict_pairKey_key" ON "ComparisonVerdict"("pairKey");
