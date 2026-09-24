import {
  PrescriptionStatus,
  PrescriptionType,
} from '@prisma/client';

export const ACTIVE_PRESCRIPTION_STATUSES: PrescriptionStatus[] = [
  PrescriptionStatus.PENDING,
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

/** @deprecated Full-course generation replaces rolling horizon; kept for tests. */
export const DOSE_HORIZON_DAYS = 7;

/** Reminder throttle between FCM nags for the same due dose. */
export const DOSE_REMINDER_INTERVAL_MS = 10 * 60 * 1000;

export function buildActivePrescriptionWhere(
  patientId: string,
  todayEnd: Date,
) {
  return {
    patientId,
    type: PrescriptionType.OUTPATIENT,
    status: { in: ACTIVE_PRESCRIPTION_STATUSES },
    items: {
      some: {
        itemType: 'DRUG' as const,
        quantityDispensed: { gt: 0 },
      },
    },
    AND: [
      {
        OR: [
          { startDate: { lte: todayEnd } },
          { patientScheduleStartAt: { not: null } },
          { scheduleConfirmedAt: null },
        ],
      },
      {
        OR: [{ endDate: null }, { endDate: { gte: todayEnd } }],
      },
    ],
  };
}
