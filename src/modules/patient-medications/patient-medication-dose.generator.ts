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
import {
  ACTIVE_PRESCRIPTION_STATUSES,
  DOSE_HORIZON_DAYS,
  MISSED_DOSE_GRACE_MS,
} from './patient-medications.constants';
import {
  deriveTimeOfDay,
  getDoseSlotHours,
  getHospitalDateString,
  hospitalLocalToUtc,
} from './patient-medications.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PatientMedicationDoseGeneratorService {
  private readonly logger = new Logger(PatientMedicationDoseGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateDosesForPrescription(
    prescriptionId: string,
    tx?: Tx,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const prescription = await client.prescription.findUnique({
      where: { id: prescriptionId },
      select: {
        id: true,
        patientId: true,
        type: true,
        status: true,
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

    let created = 0;
    for (const item of prescription.items) {
      created += await this.generateDosesForItem(
        prescription.patientId,
        item.id,
        item.frequency,
        client,
      );
    }
    return created;
  }

  async extendActivePrescriptionDoses(): Promise<{ processed: number; created: number }> {
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
      for (const item of prescription.items) {
        created += await this.generateDosesForItem(
          prescription.patientId,
          item.id,
          item.frequency,
          this.prisma,
        );
      }
    }

    const missedBefore = new Date(now.getTime() - MISSED_DOSE_GRACE_MS);
    const missedResult = await this.prisma.patientMedicationDoseLog.updateMany({
      where: {
        status: PatientMedicationDoseStatus.UPCOMING,
        scheduledAt: { lt: missedBefore },
      },
      data: { status: PatientMedicationDoseStatus.MISSED },
    });

    this.logger.log(
      `Dose extension finished: ${prescriptions.length} prescription(s), ${created} dose(s) created, ${missedResult.count} marked missed`,
    );

    return { processed: prescriptions.length, created };
  }

  private async generateDosesForItem(
    patientId: string,
    prescriptionItemId: string,
    frequency: string | null,
    client: Tx | PrismaService,
  ): Promise<number> {
    const parsed = parseFrequency(frequency);
    const slotHours = getDoseSlotHours(
      parsed.dosesPerDay,
      parsed.isIntervalBased,
      parsed.frequencyIntervalHours,
    );

    const now = new Date();
    const rows: Prisma.PatientMedicationDoseLogCreateManyInput[] = [];

    for (let dayOffset = 0; dayOffset < DOSE_HORIZON_DAYS; dayOffset += 1) {
      const refDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = getHospitalDateString(refDate);

      for (const hour of slotHours) {
        const scheduledAt = hospitalLocalToUtc(dateStr, hour);
        if (scheduledAt < now && dayOffset === 0) {
          continue;
        }
        const timeOfDay = deriveTimeOfDay(scheduledAt) as MedicationTimeOfDay;
        rows.push({
          patientId,
          prescriptionItemId,
          scheduledAt,
          timeOfDay,
          status: PatientMedicationDoseStatus.UPCOMING,
        });
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
