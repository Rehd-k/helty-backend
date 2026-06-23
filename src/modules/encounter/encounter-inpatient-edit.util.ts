import { AdmissionStatus } from '@prisma/client';

export type EncounterAdmissionContext = {
  admissionId: string | null;
  admission?: { status: AdmissionStatus } | null;
};

/** Encounter linked to an admission that is still active (shared inpatient chart). */
export function isSharedInpatientEncounter(
  encounter: EncounterAdmissionContext,
): boolean {
  return (
    encounter.admissionId != null &&
    encounter.admission?.status === AdmissionStatus.ACTIVE
  );
}

/**
 * On active-admission encounters, stamp the logged-in physician as the ordering doctor.
 * Otherwise keep the client-supplied doctor id.
 */
export function resolveOrderingDoctorId(
  encounter: EncounterAdmissionContext,
  actingStaffId: string,
  dtoDoctorId: string,
): string {
  if (isSharedInpatientEncounter(encounter)) {
    return actingStaffId;
  }
  return dtoDoctorId;
}
