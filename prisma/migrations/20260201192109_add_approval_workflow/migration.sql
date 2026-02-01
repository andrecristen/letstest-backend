-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvalScenarioEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvalTestCaseEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "approvalStatus" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER;

-- AlterTable
ALTER TABLE "TestScenario" ADD COLUMN     "approvalStatus" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER;
