-- CreateTable
CREATE TABLE "Involvement" (
    "id" SERIAL NOT NULL,
    "situation" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "Involvement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Involvement" ADD CONSTRAINT "Involvement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Involvement" ADD CONSTRAINT "Involvement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
