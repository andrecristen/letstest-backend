-- CreateTable
CREATE TABLE "TestExecution" (
    "id" SERIAL NOT NULL,
    "data" JSONB NOT NULL,
    "reported" TIMESTAMP(3) NOT NULL,
    "testTime" INTEGER NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TestExecution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
