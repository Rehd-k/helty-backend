-- CreateTable
CREATE TABLE "DrugPrice" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugPrice_drugId_wardId_idx" ON "DrugPrice"("drugId", "wardId");

-- AddForeignKey
ALTER TABLE "DrugPrice" ADD CONSTRAINT "DrugPrice_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPrice" ADD CONSTRAINT "DrugPrice_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
