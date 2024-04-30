/*
  Warnings:

  - Added the required column `name` to the `TestCase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "name" TEXT NOT NULL;
