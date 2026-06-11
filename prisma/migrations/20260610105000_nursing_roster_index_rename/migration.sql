-- Prisma truncates long unique-index names; rename only when the pre-truncation name exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'NurseShiftRoster_nurseId_nursingUnit_shiftDate_shiftType_wardId_key'
  ) THEN
    ALTER INDEX "NurseShiftRoster_nurseId_nursingUnit_shiftDate_shiftType_wardId_key"
    RENAME TO "NurseShiftRoster_nurseId_nursingUnit_shiftDate_shiftType_wa_key";
  END IF;
END $$;
