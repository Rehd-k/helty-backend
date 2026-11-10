-- Doctor-entered lab urgency shown on the laboratory waiting list.
ALTER TABLE "LabRequest" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'Routine';
