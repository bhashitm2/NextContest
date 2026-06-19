-- AlterTable: store the user's IANA timezone for localized reminder emails
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT;
