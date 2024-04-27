-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);
