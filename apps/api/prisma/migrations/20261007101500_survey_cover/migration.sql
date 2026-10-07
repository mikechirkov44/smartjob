-- AlterTable
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "coverImage" TEXT NOT NULL DEFAULT 'team-collab';
