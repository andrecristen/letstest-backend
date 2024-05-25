-- CreateTable
CREATE TABLE "Hability" (
    "id" SERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Hability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Hability" ADD CONSTRAINT "Hability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
