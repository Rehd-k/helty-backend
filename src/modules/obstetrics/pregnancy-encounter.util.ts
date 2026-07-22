import { EncounterStatus, PregnancyStatus, Prisma } from '@prisma/client';

export const ANTENATAL_ENCOUNTER_VISIT_TYPE = 'Antenatal';

export const TERMINAL_PREGNANCY_STATUSES: PregnancyStatus[] = [
  PregnancyStatus.DELIVERED,
  PregnancyStatus.LOST,
  PregnancyStatus.TERMINATED,
];

export function isTerminalPregnancyStatus(status: PregnancyStatus): boolean {
  return TERMINAL_PREGNANCY_STATUSES.includes(status);
}

export async function createAntenatalEncounterForPregnancy(
  tx: Prisma.TransactionClient,
  params: { patientId: string; doctorId: string; createdById: string },
) {
  return tx.encounter.create({
    data: {
      patientId: params.patientId,
      doctorId: params.doctorId,
      encounterType: 'OUTPATIENT',
      startTime: new Date(),
      status: EncounterStatus.ONGOING,
      visitType: ANTENATAL_ENCOUNTER_VISIT_TYPE,
      createdById: params.createdById,
    },
  });
}

export async function closeAntenatalEncounterForPregnancy(
  tx: Prisma.TransactionClient,
  pregnancyId: string,
) {
  const pregnancy = await tx.pregnancy.findUnique({
    where: { id: pregnancyId },
    select: { encounterId: true },
  });
  if (!pregnancy?.encounterId) {
    return;
  }
  await tx.encounter.update({
    where: { id: pregnancy.encounterId },
    data: {
      status: EncounterStatus.COMPLETED,
      endTime: new Date(),
    },
  });
}
