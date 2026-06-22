import { AdmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isOpdWardName } from './ward-name.util';

type DbClient = Prisma.TransactionClient | PrismaService;

/**
 * Outpatient: patient ward is OPD (trimmed, case-insensitive) and no ACTIVE admission.
 */
export async function isOutpatientPatient(
  client: DbClient,
  patientId: string,
): Promise<boolean> {
  const patient = await client.patient.findUnique({
    where: { id: patientId },
    select: { ward: { select: { name: true } } },
  });
  if (!patient) {
    return false;
  }

  const onOpdWard = isOpdWardName(patient.ward?.name);
  if (!onOpdWard) {
    return false;
  }

  const activeAdmissions = await client.admission.count({
    where: { patientId, status: AdmissionStatus.ACTIVE },
  });
  return activeAdmissions === 0;
}
