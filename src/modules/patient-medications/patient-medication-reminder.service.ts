import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PatientMedicationDoseStatus } from '@prisma/client';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';
import { DOSE_REMINDER_INTERVAL_MS } from './patient-medications.constants';
import { prescriptionItemDrugName } from './patient-medications.util';

const CRON_ENABLED =
  process.env.PATIENT_MEDICATION_DOSE_CRON_ENABLED?.trim().toLowerCase() !==
  'false';

@Injectable()
export class PatientMedicationReminderService {
  private readonly logger = new Logger(PatientMedicationReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly doseGenerator: PatientMedicationDoseGeneratorService,
    private readonly fcm: FcmService,
    private readonly family: PatientFamilyService,
  ) {}

  /** Every 10 minutes: miss transitions + due-dose FCM nags. */
  @Cron('*/10 * * * *', {
    name: 'patient-medication-dose-reminders',
    timeZone: HOSPITAL_TIMEZONE,
  })
  async handleReminders(): Promise<void> {
    if (!CRON_ENABLED) return;

    this.logger.log('Starting patient medication dose reminders');
    try {
      const { missed } = await this.doseGenerator.extendActivePrescriptionDoses();
      for (const dose of missed) {
        await this.notifyMissed(dose);
      }
      await this.sendDueReminders();
    } catch (err) {
      this.logger.error(
        `Patient medication reminders failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async sendDueReminders(): Promise<void> {
    const now = new Date();
    const reminderBefore = new Date(now.getTime() - DOSE_REMINDER_INTERVAL_MS);

    const dueDoses = await this.prisma.patientMedicationDoseLog.findMany({
      where: {
        status: PatientMedicationDoseStatus.UPCOMING,
        scheduledAt: { lte: now },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lte: reminderBefore } },
        ],
        prescriptionItem: {
          prescription: {
            scheduleConfirmedAt: { not: null },
            OR: [
              { patientScheduleStartAt: null },
              { patientScheduleStartAt: { lte: now } },
            ],
          },
        },
      },
      take: 500,
      include: {
        prescriptionItem: {
          include: {
            drug: { select: { brandName: true, genericName: true } },
            prescription: {
              select: {
                id: true,
                patientId: true,
              },
            },
          },
        },
      },
    });

    for (const dose of dueDoses) {
      const drugName = prescriptionItemDrugName(dose.prescriptionItem);
      const patientId = dose.prescriptionItem.prescription.patientId;
      const prescriptionId = dose.prescriptionItem.prescription.id;
      const scheduledIso = dose.scheduledAt.toISOString();

      await this.fcm.sendToPatient(patientId, {
        title: 'Time to take your medication',
        body: `${drugName} is due. Tap Taken in the app when you take it.`,
        data: {
          type: 'MEDICATION',
          doseId: dose.id,
          prescriptionId,
          patientId,
          drugName,
          scheduledAt: scheduledIso,
          status: 'UPCOMING',
        },
      });

      const parentIds = await this.family.findPrincipalParentIds(patientId);
      if (parentIds.length) {
        const child = await this.prisma.patient.findUnique({
          where: { id: patientId },
          select: patientNameFieldsSelect,
        });
        const childName = child
          ? formatPatientDisplayName(child)
          : 'Your family member';

        for (const parentId of parentIds) {
          await this.fcm.sendToPatient(parentId, {
            title: 'Medication reminder',
            body: `${childName}: ${drugName} is due.`,
            data: {
              type: 'MEDICATION',
              doseId: dose.id,
              prescriptionId,
              patientId,
              drugName,
              scheduledAt: scheduledIso,
              status: 'UPCOMING',
            },
          });
        }
      }

      await this.prisma.patientMedicationDoseLog.update({
        where: { id: dose.id },
        data: { lastReminderAt: now },
      });
    }

    this.logger.log(`Sent reminders for ${dueDoses.length} due dose(s)`);
  }

  private async notifyMissed(dose: {
    id: string;
    patientId: string;
    prescriptionId: string;
    drugName: string;
    scheduledAt: Date;
  }): Promise<void> {
    const scheduledIso = dose.scheduledAt.toISOString();

    await this.fcm.sendToPatient(dose.patientId, {
      title: 'Missed medication dose',
      body: `${dose.drugName} was marked as missed.`,
      data: {
        type: 'MEDICATION_MISSED',
        doseId: dose.id,
        prescriptionId: dose.prescriptionId,
        patientId: dose.patientId,
        drugName: dose.drugName,
        scheduledAt: scheduledIso,
        status: 'MISSED',
      },
    });

    const parentIds = await this.family.findPrincipalParentIds(dose.patientId);
    if (parentIds.length) {
      const child = await this.prisma.patient.findUnique({
        where: { id: dose.patientId },
        select: patientNameFieldsSelect,
      });
      const childName = child
        ? formatPatientDisplayName(child)
        : 'Your family member';

      for (const parentId of parentIds) {
        await this.fcm.sendToPatient(parentId, {
          title: 'Missed medication dose',
          body: `${childName} missed ${dose.drugName}.`,
          data: {
            type: 'MEDICATION_MISSED',
            doseId: dose.id,
            prescriptionId: dose.prescriptionId,
            patientId: dose.patientId,
            drugName: dose.drugName,
            scheduledAt: scheduledIso,
            status: 'MISSED',
          },
        });
      }
    }
  }
}
