import { AdmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaService;

export type PatientAdmissionContext = {
  admissionId: string | null;
  wardId: string | null;
};

const OPEN_ADMISSION_STATUSES: AdmissionStatus[] = [
  AdmissionStatus.ACTIVE,
  AdmissionStatus.PENDING_BILLING_CLEARANCE,
];

/**
 * Returns admissionId/wardId from the patient's most recent active or
 * pending-clearance admission, or nulls when the patient is not inpatient.
 */
export async function getPatientAdmissionContext(
  client: DbClient,
  patientId: string,
): Promise<PatientAdmissionContext> {
  const admission = await client.admission.findFirst({
    where: {
      patientId,
      status: { in: OPEN_ADMISSION_STATUSES },
    },
    orderBy: { admissionDateTime: 'desc' },
    select: { id: true, wardId: true },
  });

  return {
    admissionId: admission?.id ?? null,
    wardId: admission?.wardId ?? null,
  };
}
