import { Injectable, Logger } from '@nestjs/common';
import {
  MedicationTimeOfDay,
  PatientMedicationDoseStatus,
  PrescriptionItemType,
  PrescriptionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseFrequency } from '../medication-schedule/rx-schedule.utils';
import { ACTIVE_PRESCRIPTION_STATUSES } from './patient-medications.constants';
import {
  deriveTimeOfDay,
  getDoseSlotHours,
  getHospitalDateString,
  hospitalLocalToUtc,
} from './patient-medications.util';

type Tx = Prisma.TransactionClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_COURSE_DAYS = 365;

export type MissedDoseInfo = {
  id: string;
  patientId: string;
  prescriptionItemId: string;
  prescriptionId: string;
  drugName: string;
  scheduledAt: Date;
};

@Injectable()
export class PatientMedicationDoseGeneratorService {
  private readonly logger = new Logger(PatientMedicationDoseGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateDosesForPrescription(
    prescriptionId: string,
    tx?: Tx,
    options?: { fromDate?: Date },
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const prescription = await client.prescription.findUnique({
      where: { id: prescriptionId },
      select: {
        id: true,
        patientId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        patientScheduleStartAt: true,
        items: {
          where: {
            itemType: PrescriptionItemType.DRUG,
            quantityDispensed: { gt: 0 },
          },
          select: {
            id: true,
            frequency: true,
          },
        },
      },
    });

    if (
      !prescription ||
      prescription.type !== PrescriptionType.OUTPATIENT ||
      !ACTIVE_PRESCRIPTION_STATUSES.includes(prescription.status)
    ) {
      return 0;
    }

    const effectiveStart =
      prescription.patientScheduleStartAt ?? prescription.startDate;
    if (!effectiveStart) {
      return 0;
    }

    let created = 0;
    for (const item of prescription.items) {
      created += await this.generateDosesForItem(
        prescription.patientId,
        item.id,
        item.frequency,
        effectiveStart,
        prescription.endDate,
        client,
        options?.fromDate,
      );
    }
    return created;
  }

  /**
   * Ensure all active outpatient courses have dose rows through endDate,
   * and apply miss transitions. Returns missed dose infos for FCM.
   */
  async extendActivePrescriptionDoses(): Promise<{
    processed: number;
    created: number;
    missed: MissedDoseInfo[];
  }> {
    const now = new Date();
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        type: PrescriptionType.OUTPATIENT,
        status: { in: ACTIVE_PRESCRIPTION_STATUSES },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        items: {
          some: {
            itemType: PrescriptionItemType.DRUG,
            quantityDispensed: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        patientId: true,
        startDate: true,
        endDate: true,
        patientScheduleStartAt: true,
        items: {
          where: {
            itemType: PrescriptionItemType.DRUG,
            quantityDispensed: { gt: 0 },
          },
          select: { id: true, frequency: true },
        },
      },
    });

    let created = 0;
    for (const prescription of prescriptions) {
      const effectiveStart =
        prescription.patientScheduleStartAt ?? prescription.startDate;
      if (!effectiveStart) continue;

      for (const item of prescription.items) {
        created += await this.generateDosesForItem(
          prescription.patientId,
          item.id,
          item.frequency,
          effectiveStart,
          prescription.endDate,
          this.prisma,
        );
      }
    }

    const missed = await this.applyMissTransitions(now);

    this.logger.log(
      `Dose extension finished: ${prescriptions.length} prescription(s), ${created} dose(s) created, ${missed.length} marked missed`,
    );

    return { processed: prescriptions.length, created, missed };
  }

  /**
   * Delete future UPCOMING doses and regenerate from effective start.
   * Used when patient sets a delayed schedule start.
   */
  async regenerateUpcomingDoses(
    prescriptionId: string,
    tx?: Tx,
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const items = await client.prescriptionItem.findMany({
      where: {
        prescriptionId,
        itemType: PrescriptionItemType.DRUG,
      },
      select: { id: true },
    });
    const itemIds = items.map((i) => i.id);
    if (!itemIds.length) return 0;

    await client.patientMedicationDoseLog.deleteMany({
      where: {
        prescriptionItemId: { in: itemIds },
        status: PatientMedicationDoseStatus.UPCOMING,
      },
    });

    return this.generateDosesForPrescription(prescriptionId, client);
  }

  async applyMissTransitions(now = new Date()): Promise<MissedDoseInfo[]> {
    const missed: MissedDoseInfo[] = [];

    // Never-started courses past endDate: mark all remaining UPCOMING as MISSED
    const expiredNeverStarted = await this.prisma.prescription.findMany({
      where: {
        type: PrescriptionType.OUTPATIENT,
        endDate: { lt: now },
        items: {
          some: {
            itemType: PrescriptionItemType.DRUG,
            quantityDispensed: { gt: 0 },
            doseLogs: {
              some: { status: PatientMedicationDoseStatus.UPCOMING },
            },
            NOT: {
              doseLogs: {
                some: { status: PatientMedicationDoseStatus.TAKEN },
              },
            },
          },
        },
      },
      select: {
        id: true,
        patientId: true,
        items: {
          where: {
            itemType: PrescriptionItemType.DRUG,
            quantityDispensed: { gt: 0 },
          },
          select: {
            id: true,
            drug: { select: { brandName: true, genericName: true } },
            doseLogs: {
              where: { status: PatientMedicationDoseStatus.UPCOMING },
              select: { id: true, scheduledAt: true },
            },
          },
        },
      },
    });

    for (const rx of expiredNeverStarted) {
      for (const item of rx.items) {
        const drugName =
          item.drug?.brandName || item.drug?.genericName || 'Medication';
        for (const dose of item.doseLogs) {
          await this.prisma.patientMedicationDoseLog.update({
            where: { id: dose.id },
            data: {
              status: PatientMedicationDoseStatus.MISSED,
              missedAt: now,
            },
          });
          missed.push({
            id: dose.id,
            patientId: rx.patientId,
            prescriptionItemId: item.id,
            prescriptionId: rx.id,
            drugName,
            scheduledAt: dose.scheduledAt,
          });
        }
      }
    }

    // Per-dose: mark UPCOMING as MISSED when the next dose time (or course end) has passed
    const dueUpcoming = await this.prisma.patientMedicationDoseLog.findMany({
      where: {
        status: PatientMedicationDoseStatus.UPCOMING,
        scheduledAt: { lte: now },
      },
      select: {
        id: true,
        patientId: true,
        prescriptionItemId: true,
        scheduledAt: true,
        prescriptionItem: {
          select: {
            id: true,
            drug: { select: { brandName: true, genericName: true } },
            prescription: {
              select: { id: true, endDate: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 2000,
    });

    // Group by prescriptionItemId to find next dose boundaries
    const byItem = new Map<string, typeof dueUpcoming>();
    for (const dose of dueUpcoming) {
      const list = byItem.get(dose.prescriptionItemId) ?? [];
      list.push(dose);
      byItem.set(dose.prescriptionItemId, list);
    }

    for (const [itemId, doses] of byItem) {
      const allUpcomingForItem =
        await this.prisma.patientMedicationDoseLog.findMany({
          where: {
            prescriptionItemId: itemId,
            status: PatientMedicationDoseStatus.UPCOMING,
          },
          orderBy: { scheduledAt: 'asc' },
          select: { id: true, scheduledAt: true },
        });

      const endDate = doses[0]?.prescriptionItem.prescription.endDate ?? null;
      const drugName =
        doses[0]?.prescriptionItem.drug?.brandName ||
        doses[0]?.prescriptionItem.drug?.genericName ||
        'Medication';
      const prescriptionId = doses[0]?.prescriptionItem.prescription.id ?? '';

      for (let i = 0; i < doses.length; i += 1) {
        const dose = doses[i];
        // Already missed in never-started pass
        if (missed.some((m) => m.id === dose.id)) continue;

        const nextInAll = allUpcomingForItem.find(
          (d) => d.scheduledAt.getTime() > dose.scheduledAt.getTime(),
        );
        const missDeadline = nextInAll?.scheduledAt ?? endDate;

        if (!missDeadline || missDeadline.getTime() > now.getTime()) {
          continue;
        }

        await this.prisma.patientMedicationDoseLog.update({
          where: { id: dose.id },
          data: {
            status: PatientMedicationDoseStatus.MISSED,
            missedAt: now,
          },
        });
        missed.push({
          id: dose.id,
          patientId: dose.patientId,
          prescriptionItemId: dose.prescriptionItemId,
          prescriptionId,
          drugName,
          scheduledAt: dose.scheduledAt,
        });
      }
    }

    return missed;
  }

  private async generateDosesForItem(
    patientId: string,
    prescriptionItemId: string,
    frequency: string | null,
    startDate: Date,
    endDate: Date | null,
    client: Tx | PrismaService,
    fromDate?: Date,
  ): Promise<number> {
    const parsed = parseFrequency(frequency);
    const courseEnd =
      endDate ??
      new Date(startDate.getTime() + 7 * MS_PER_DAY);

    const earliestCreate = fromDate ?? startDate;
    const rows: Prisma.PatientMedicationDoseLogCreateManyInput[] = [];

    if (parsed.isIntervalBased && parsed.frequencyIntervalHours > 0) {
      const intervalMs = parsed.frequencyIntervalHours * 60 * 60 * 1000;
      let cursor = new Date(startDate);
      let safety = 0;
      while (cursor.getTime() <= courseEnd.getTime() && safety < 2000) {
        safety += 1;
        if (cursor.getTime() >= earliestCreate.getTime()) {
          rows.push({
            patientId,
            prescriptionItemId,
            scheduledAt: new Date(cursor),
            timeOfDay: deriveTimeOfDay(cursor) as MedicationTimeOfDay,
            status: PatientMedicationDoseStatus.UPCOMING,
          });
        }
        cursor = new Date(cursor.getTime() + intervalMs);
      }
    } else {
      const slotHours = getDoseSlotHours(
        parsed.dosesPerDay,
        false,
        parsed.frequencyIntervalHours,
      );
      const startDay = getHospitalDateString(startDate);
      let dayOffset = 0;
      let safety = 0;
      while (safety < MAX_COURSE_DAYS) {
        safety += 1;
        const refMs =
          hospitalLocalToUtc(startDay, 0).getTime() + dayOffset * MS_PER_DAY;
        const refDate = new Date(refMs);
        if (refDate.getTime() > courseEnd.getTime()) break;

        const dateStr = getHospitalDateString(refDate);
        for (const hour of slotHours) {
          const scheduledAt = hospitalLocalToUtc(dateStr, hour);
          if (scheduledAt.getTime() < startDate.getTime()) continue;
          if (scheduledAt.getTime() > courseEnd.getTime()) continue;
          if (scheduledAt.getTime() < earliestCreate.getTime()) continue;

          rows.push({
            patientId,
            prescriptionItemId,
            scheduledAt,
            timeOfDay: deriveTimeOfDay(scheduledAt) as MedicationTimeOfDay,
            status: PatientMedicationDoseStatus.UPCOMING,
          });
        }
        dayOffset += 1;
      }
    }

    if (!rows.length) return 0;

    const result = await client.patientMedicationDoseLog.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  }
}
