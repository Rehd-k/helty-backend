/*
  Warnings:

  - You are about to drop the column `lastname` on the `NoIdPatient` table. All the data in the column will be lost.
  - Added the required column `age` to the `NoIdPatient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `NoIdPatient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surname` to the `NoIdPatient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NoIdPatient" DROP COLUMN "lastname",
ADD COLUMN     "age" TEXT NOT NULL,
ADD COLUMN     "gender" TEXT NOT NULL,
ADD COLUMN     "surname" TEXT NOT NULL;
