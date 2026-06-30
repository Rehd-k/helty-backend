import {
  PrescriptionStatus,
  PrescriptionType,
} from '@prisma/client';

export const ACTIVE_PRESCRIPTION_STATUSES: PrescriptionStatus[] = [
  PrescriptionStatus.PARTIALLY_DISPENSED,
  PrescriptionStatus.COMPLETED,
];

export const ACTIVE_PRESCRIPTION_INCLUDE = {
  doctor: { select: { firstName: true, lastName: true } },
  items: {
    where: { itemType: 'DRUG' as const },
    include: {
      drug: { select: { brandName: true, genericName: true, strength: true } },
      doseLogs: {
        where: { status: 'TAKEN' as const },
        select: { id: true },
      },
    },
  },
} as const;

export const DOSE_LOG_INCLUDE = {
  prescriptionItem: {
    include: {
      drug: { select: { brandName: true, genericName: true } },
      prescription: { select: { patientId: true } },
    },
  },
} as const;

export const DOSE_HORIZON_DAYS = 7;

export const MISSED_DOSE_GRACE_MS = 2 * 60 * 60 * 1000;

export function buildActivePrescriptionWhere(
  patientId: string,
  todayEnd: Date,
) {
  return {
    patientId,
    type: PrescriptionType.OUTPATIENT,
    status: { in: ACTIVE_PRESCRIPTION_STATUSES },
    startDate: { lte: todayEnd },
    OR: [{ endDate: null }, { endDate: { gte: todayEnd } }],
  };
}
