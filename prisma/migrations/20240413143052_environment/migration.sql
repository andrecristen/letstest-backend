-- CreateTable
CREATE TABLE "Environment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "situation" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
