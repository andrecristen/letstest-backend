-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "environmentId" INTEGER;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
