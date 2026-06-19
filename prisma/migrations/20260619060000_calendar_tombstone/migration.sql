-- CreateTable
CREATE TABLE "CalendarTombstone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarTombstone_contestId_idx" ON "CalendarTombstone"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTombstone_userId_contestId_key" ON "CalendarTombstone"("userId", "contestId");

-- AddForeignKey
ALTER TABLE "CalendarTombstone" ADD CONSTRAINT "CalendarTombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarTombstone" ADD CONSTRAINT "CalendarTombstone_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
