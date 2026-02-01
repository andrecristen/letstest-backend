-- AlterTable
ALTER TABLE "TestCaseAssignment" ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "lastPausedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0;
