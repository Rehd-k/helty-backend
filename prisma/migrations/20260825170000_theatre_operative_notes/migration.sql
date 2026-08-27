-- CreateTable
CREATE TABLE "TheatreOperativeNote" (
    "id" TEXT NOT NULL,
    "theatreCaseId" TEXT NOT NULL,
    "authoredById" TEXT NOT NULL,
    "updatedById" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "answersJson" JSONB NOT NULL,
    "narrative" TEXT NOT NULL DEFAULT '',
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheatreOperativeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TheatreOperativeNote_theatreCaseId_idx" ON "TheatreOperativeNote"("theatreCaseId");

-- CreateIndex
CREATE INDEX "TheatreOperativeNote_authoredById_idx" ON "TheatreOperativeNote"("authoredById");

-- CreateIndex
CREATE INDEX "TheatreOperativeNote_createdAt_idx" ON "TheatreOperativeNote"("createdAt");

-- AddForeignKey
ALTER TABLE "TheatreOperativeNote" ADD CONSTRAINT "TheatreOperativeNote_theatreCaseId_fkey" FOREIGN KEY ("theatreCaseId") REFERENCES "TheatreCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreOperativeNote" ADD CONSTRAINT "TheatreOperativeNote_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreOperativeNote" ADD CONSTRAINT "TheatreOperativeNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy existing free-text theatre notes into a first structured record.
INSERT INTO "TheatreOperativeNote" (
    "id",
    "theatreCaseId",
    "authoredById",
    "schemaVersion",
    "answersJson",
    "narrative",
    "additionalNotes",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    tc."id",
    COALESCE(tc."performedById", sr."requestedById"),
    1,
    '{}'::jsonb,
    TRIM(BOTH E'\n' FROM CONCAT_WS(
        E'\n\n',
        CASE WHEN tc."findings" IS NOT NULL AND BTRIM(tc."findings") <> '' THEN 'Findings: ' || BTRIM(tc."findings") END,
        CASE WHEN tc."complications" IS NOT NULL AND BTRIM(tc."complications") <> '' THEN 'Complications: ' || BTRIM(tc."complications") END,
        CASE WHEN tc."operativeNotes" IS NOT NULL AND BTRIM(tc."operativeNotes") <> '' THEN BTRIM(tc."operativeNotes") END
    )),
    CASE
        WHEN tc."operativeNotes" IS NOT NULL AND BTRIM(tc."operativeNotes") <> '' THEN BTRIM(tc."operativeNotes")
        ELSE NULL
    END,
    tc."createdAt",
    tc."updatedAt"
FROM "TheatreCase" tc
INNER JOIN "SurgeryRequest" sr ON sr."id" = tc."surgeryRequestId"
WHERE COALESCE(tc."performedById", sr."requestedById") IS NOT NULL
  AND (
    (tc."findings" IS NOT NULL AND BTRIM(tc."findings") <> '')
    OR (tc."complications" IS NOT NULL AND BTRIM(tc."complications") <> '')
    OR (tc."operativeNotes" IS NOT NULL AND BTRIM(tc."operativeNotes") <> '')
  );
