-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "wardId" TEXT;

-- CreateIndex
CREATE INDEX "Staff_wardId_idx" ON "Staff"("wardId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
