import { Prisma } from '@prisma/client';

/**
 * Medication orders scoped to an admission.
 * Newer rows set admissionId; legacy encounter prescriptions only set encounterId
 * (Encounter.admissionId points at the admission).
 */
export function medicationOrdersForAdmissionWhere(
  admissionId: string,
): Prisma.MedicationOrderWhereInput {
  return {
    OR: [{ admissionId }, { encounter: { admissionId } }],
  };
}

export function medicationOrderForAdmissionWhere(
  orderId: string,
  admissionId: string,
): Prisma.MedicationOrderWhereInput {
  return {
    id: orderId,
    ...medicationOrdersForAdmissionWhere(admissionId),
  };
}
