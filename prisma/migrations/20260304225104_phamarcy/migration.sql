/*
  Warnings:

  - Added the required column `searviceCode` to the `Drug` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Drug" ADD COLUMN     "searviceCode" TEXT NOT NULL;
