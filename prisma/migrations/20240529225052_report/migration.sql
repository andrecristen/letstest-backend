-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "commentary" TEXT NOT NULL,
    "testExecutionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_testExecutionId_fkey" FOREIGN KEY ("testExecutionId") REFERENCES "TestExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
