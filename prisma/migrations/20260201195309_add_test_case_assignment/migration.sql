-- CreateTable
CREATE TABLE "TestCaseAssignment" (
    "id" SERIAL NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedById" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseAssignment_testCaseId_userId_key" ON "TestCaseAssignment"("testCaseId", "userId");

-- AddForeignKey
ALTER TABLE "TestCaseAssignment" ADD CONSTRAINT "TestCaseAssignment_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseAssignment" ADD CONSTRAINT "TestCaseAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseAssignment" ADD CONSTRAINT "TestCaseAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
