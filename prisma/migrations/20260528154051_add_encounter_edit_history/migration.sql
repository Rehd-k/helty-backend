-- CreateTable
CREATE TABLE "EncounterEditHistory" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "changedKeys" TEXT[],

    CONSTRAINT "EncounterEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncounterEditHistory_encounterId_editedAt_idx" ON "EncounterEditHistory"("encounterId", "editedAt");

-- AddForeignKey
ALTER TABLE "EncounterEditHistory" ADD CONSTRAINT "EncounterEditHistory_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterEditHistory" ADD CONSTRAINT "EncounterEditHistory_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
