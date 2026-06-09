-- AlterTable
ALTER TABLE "LabOrderItem" ADD COLUMN "astRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LabAntibiotic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAntibiotic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAstResultOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAstResultOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAstResult" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "antibioticId" TEXT NOT NULL,
    "resultOptionId" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAstResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabAntibiotic_name_key" ON "LabAntibiotic"("name");

-- CreateIndex
CREATE INDEX "LabAntibiotic_isActive_idx" ON "LabAntibiotic"("isActive");

-- CreateIndex
CREATE INDEX "LabAntibiotic_position_idx" ON "LabAntibiotic"("position");

-- CreateIndex
CREATE UNIQUE INDEX "LabAstResultOption_label_key" ON "LabAstResultOption"("label");

-- CreateIndex
CREATE INDEX "LabAstResultOption_isActive_idx" ON "LabAstResultOption"("isActive");

-- CreateIndex
CREATE INDEX "LabAstResultOption_position_idx" ON "LabAstResultOption"("position");

-- CreateIndex
CREATE INDEX "LabOrderItem_astRequested_idx" ON "LabOrderItem"("astRequested");

-- CreateIndex
CREATE INDEX "LabAstResult_orderItemId_idx" ON "LabAstResult"("orderItemId");

-- CreateIndex
CREATE INDEX "LabAstResult_antibioticId_idx" ON "LabAstResult"("antibioticId");

-- CreateIndex
CREATE INDEX "LabAstResult_resultOptionId_idx" ON "LabAstResult"("resultOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LabAstResult_orderItemId_antibioticId_key" ON "LabAstResult"("orderItemId", "antibioticId");

-- AddForeignKey
ALTER TABLE "LabAstResult" ADD CONSTRAINT "LabAstResult_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAstResult" ADD CONSTRAINT "LabAstResult_antibioticId_fkey" FOREIGN KEY ("antibioticId") REFERENCES "LabAntibiotic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAstResult" ADD CONSTRAINT "LabAstResult_resultOptionId_fkey" FOREIGN KEY ("resultOptionId") REFERENCES "LabAstResultOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAstResult" ADD CONSTRAINT "LabAstResult_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
