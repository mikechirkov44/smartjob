-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'GRID';

-- AlterTable
ALTER TABLE "SurveyQuestion" ADD COLUMN "gridRows" JSONB;
ALTER TABLE "SurveyQuestion" ADD COLUMN "gridColumns" JSONB;
ALTER TABLE "SurveyQuestion" ADD COLUMN "requireAllRows" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "valueJson" JSONB;
