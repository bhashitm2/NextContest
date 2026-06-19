-- AlterTable: public profile slug
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable: cross-platform stats on PlatformHandle
ALTER TABLE "PlatformHandle" ADD COLUMN     "maxRating" INTEGER,
ADD COLUMN     "problemsSolved" INTEGER,
ADD COLUMN     "rank" TEXT,
ADD COLUMN     "stats" JSONB;
