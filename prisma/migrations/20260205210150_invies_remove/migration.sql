/*
  Warnings:

  - You are about to drop the column `situation` on the `Involvement` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[projectId,userId,type]` on the table `Involvement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Involvement" DROP COLUMN "situation";

-- CreateIndex
CREATE UNIQUE INDEX "Involvement_projectId_userId_type_key" ON "Involvement"("projectId", "userId", "type");
