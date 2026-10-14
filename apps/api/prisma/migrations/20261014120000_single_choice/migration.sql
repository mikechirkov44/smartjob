-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'SINGLE';

-- AlterTable
ALTER TABLE "SurveyQuestion" ADD COLUMN "choices" JSONB;
ALTER TABLE "SurveyQuestion" ADD COLUMN "allowOther" BOOLEAN NOT NULL DEFAULT false;
