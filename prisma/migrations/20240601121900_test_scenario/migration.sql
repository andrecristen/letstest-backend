-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "testScenarioId" INTEGER;

-- CreateTable
CREATE TABLE "TestScenario" (
    "id" SERIAL NOT NULL,
    "data" JSONB NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "TestScenario_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TestScenario" ADD CONSTRAINT "TestScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_testScenarioId_fkey" FOREIGN KEY ("testScenarioId") REFERENCES "TestScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
