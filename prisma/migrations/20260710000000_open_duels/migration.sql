-- v1.9 Open duels: shareable single-use invite links.
-- ADD VALUE is safe in-transaction here: no statement in this migration uses
-- the new value (same pattern as the platform-enum additions).
ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'OPEN';

-- An unclaimed open duel has no opponent yet. FK + ON DELETE CASCADE remain
-- valid on a nullable column.
ALTER TABLE "Duel" ALTER COLUMN "opponentId" DROP NOT NULL;

-- Single-use join token (null for friend invites).
ALTER TABLE "Duel" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "Duel_inviteToken_key" ON "Duel"("inviteToken");
