-- Add v1.1 platforms to the Platform enum (append-only).
-- ADD VALUE is safe here: no statement in this migration USES the new values.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'GEEKSFORGEEKS';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'CODE360';
