-- Compile-error submission verification (v0.8): pinned challenge problem + start time.
ALTER TABLE "PlatformHandle" ADD COLUMN "verifyProblem" TEXT;
ALTER TABLE "PlatformHandle" ADD COLUMN "verifyStartedAt" TIMESTAMP(3);
