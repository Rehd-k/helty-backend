import { Injectable, Logger } from '@nestjs/common';
import {
  AdmissionAlertType,
  AlertSeverity,
  MedicationAdminStatus,
  MedicationAdministrationLifecycleStatus,
  MedicationOrderSchedule,
  MedicationScheduleStatus,
  Prisma,
  RxDurationUnit,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  patientNameFieldsSelect,
  toPatientNameWithLegacyKey,
} from '../../common/utils/patient-display-name.util';
import { medicationOrdersForAdmissionWhere } from '../inpatient-nursing/admission-medication-order.util';
import {
  MedicationDoseScheduleApi,
  MedicationDoseScheduleItemApi,
  MEDICATION_ALERT_TYPES,
  ParsedDuration,
} from './medication-schedule.types';
import {
  addDuration,
  computeNextDueAt,
  parseDuration,
  parseFrequency,
} from './rx-schedule.utils';

type Tx = Prisma.TransactionClient;

type ScheduleWithOrder = MedicationOrderSchedule & {
  medicationOrder: {
    id: string;
    admissionId: string | null;
    drugName: string;
    dose: string | null;
    frequency: string | null;
    duration: string | null;
    administrationStatus: MedicationAdministrationLifecycleStatus;
  };
};

const DUE_SOON_WINDOW_MINUTES = Number.parseInt(
  process.env.MEDICATION_DUE_SOON_WINDOW_MINUTES ?? '30',
  10,
);

@Injectable()
export class MedicationScheduleService {
  private readonly logger = new Logger(MedicationScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  getDueSoonWindowMs(): number {
    return DUE_SOON_WINDOW_MINUTES * 60 * 1000;
  }

  mapScheduleToApi(schedule: MedicationOrderSchedule): MedicationDoseScheduleApi {
    return {
      scheduleStartedAt: schedule.scheduleStartedAt?.toISOString() ?? null,
      courseEndsAt: schedule.courseEndsAt?.toISOString() ?? null,
      nextDueAt: schedule.nextDueAt?.toISOString() ?? null,
      lastAdministeredAt: schedule.lastAdministeredAt?.toISOString() ?? null,
      doseSequenceNumber: schedule.doseSequenceNumber,
      scheduleStatus: schedule.scheduleStatus,
      dosesPerDay: schedule.dosesPerDay?.toString() ?? null,
      frequencyIntervalHours:
        schedule.frequencyIntervalHours?.toString() ?? null,
      durationValue: schedule.durationValue,
      durationUnit: schedule.durationUnit,
      beyondDurationConsentAt:
        schedule.beyondDurationConsentAt?.toISOString() ?? null,
      beyondDurationConsentById: schedule.beyondDurationConsentById,
      beyondDurationConsentNote: schedule.beyondDurationConsentNote,
    };
  }

  mapOrderToScheduleItem(order: {
    id: string;
    drugName: string;
    dose: string | null;
    frequency: string | null;
    duration: string | null;
    administrationStatus: MedicationAdministrationLifecycleStatus;
    doseSchedule: MedicationOrderSchedule | null;
  }): MedicationDoseScheduleItemApi {
    const schedule = order.doseSchedule;
    return {
      medicationOrderId: order.id,
      drugName: order.drugName,
      dose: order.dose,
      frequency: order.frequency,
      duration: order.duration,
      administrationStatus: order.administrationStatus,
      doseSchedule: schedule
        ? this.mapScheduleToApi(schedule)
        : this.emptyScheduleApi(),
    };
  }

  private emptyScheduleApi(): MedicationDoseScheduleApi {
    return {
      scheduleStartedAt: null,
      courseEndsAt: null,
      nextDueAt: null,
      lastAdministeredAt: null,
      doseSequenceNumber: 0,
      scheduleStatus: MedicationScheduleStatus.NOT_STARTED,
      dosesPerDay: null,
      frequencyIntervalHours: null,
      durationValue: null,
      durationUnit: null,
      beyondDurationConsentAt: null,
      beyondDurationConsentById: null,
      beyondDurationConsentNote: null,
    };
  }

  async ensureScheduleForOrder(
    orderId: string,
    tx?: Tx,
    orderHints?: {
      frequency?: string | null;
      duration?: string | null;
    },
  ): Promise<MedicationOrderSchedule> {
    const client = tx ?? this.prisma;
    const existing = await client.medicationOrderSchedule.findUnique({
      where: { medicationOrderId: orderId },
    });
    if (existing) return existing;

    const order = await client.medicationOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        admissionId: true,
        frequency: true,
        duration: true,
      },
    });
    if (!order?.admissionId) {
      throw new Error(
        `Cannot create dose schedule for non-inpatient order ${orderId}`,
      );
    }

    const frequency = orderHints?.frequency ?? order.frequency;
    const duration = orderHints?.duration ?? order.duration;
    const parsedFreq = parseFrequency(frequency);
    const parsedDuration = parseDuration(duration);

    return client.medicationOrderSchedule.create({
      data: {
        medicationOrderId: orderId,
        dosesPerDay: new Prisma.Decimal(parsedFreq.dosesPerDay),
        frequencyIntervalHours: new Prisma.Decimal(
          parsedFreq.frequencyIntervalHours,
        ),
        ...(parsedDuration && {
          durationValue: parsedDuration.durationValue,
          durationUnit: parsedDuration.durationUnit,
        }),
      },
    });
  }

  recomputeScheduleStatus(
    now: Date,
    schedule: Pick<
      MedicationOrderSchedule,
      | 'scheduleStartedAt'
      | 'courseEndsAt'
      | 'nextDueAt'
      | 'beyondDurationConsentAt'
      | 'scheduleStatus'
    >,
    administrationStatus: MedicationAdministrationLifecycleStatus,
  ): MedicationScheduleStatus {
    if (administrationStatus === MedicationAdministrationLifecycleStatus.STOPPED) {
      return MedicationScheduleStatus.STOPPED;
    }
    if (
      schedule.courseEndsAt &&
      now > schedule.courseEndsAt &&
      !schedule.beyondDurationConsentAt
    ) {
      return MedicationScheduleStatus.EXPIRED;
    }
    if (!schedule.scheduleStartedAt) {
      return MedicationScheduleStatus.NOT_STARTED;
    }
    if (schedule.nextDueAt && now > schedule.nextDueAt) {
      return MedicationScheduleStatus.OVERDUE;
    }
    if (
      schedule.nextDueAt &&
      schedule.nextDueAt.getTime() - now.getTime() <= this.getDueSoonWindowMs()
    ) {
      return MedicationScheduleStatus.DUE_SOON;
    }
    return MedicationScheduleStatus.ACTIVE;
  }

  applyParsedDurationToSchedule(
    schedule: MedicationOrderSchedule,
    parsed: ParsedDuration | null,
    scheduleStartedAt: Date | null,
  ): Partial<MedicationOrderSchedule> {
    if (!parsed) {
      return {
        durationValue: null,
        durationUnit: null,
        courseEndsAt: null,
      };
    }
    return {
      durationValue: parsed.durationValue,
      durationUnit: parsed.durationUnit,
      courseEndsAt: scheduleStartedAt
        ? addDuration(
            scheduleStartedAt,
            parsed.durationValue,
            parsed.durationUnit,
          )
        : schedule.courseEndsAt,
    };
  }

  buildScheduleUpdateFromAdministration(params: {
    schedule: MedicationOrderSchedule;
    order: {
      frequency: string | null;
      duration: string | null;
      administrationStatus: MedicationAdministrationLifecycleStatus;
    };
    status: MedicationAdminStatus;
    actualTime: Date;
    now?: Date;
  }): {
    scheduleData: Prisma.MedicationOrderScheduleUpdateInput;
    doseNumber: number | null;
    isFirstDose: boolean;
  } {
    const { schedule, order, status, actualTime } = params;
    const now = params.now ?? new Date();
    const parsedFreq = parseFrequency(order.frequency);
    const parsedDuration = parseDuration(order.duration);
    const isFirstDose = !schedule.scheduleStartedAt;

    if (
      status === MedicationAdminStatus.GIVEN ||
      status === MedicationAdminStatus.DELAYED
    ) {
      const scheduleStartedAt = schedule.scheduleStartedAt ?? actualTime;
      const nextDueAt = computeNextDueAt(actualTime, parsedFreq);
      const doseSequenceNumber = schedule.doseSequenceNumber + 1;
      const durationPatch = this.applyParsedDurationToSchedule(
        schedule,
        parsedDuration ?? (schedule.durationValue && schedule.durationUnit
          ? {
              durationValue: schedule.durationValue,
              durationUnit: schedule.durationUnit,
            }
          : null),
        isFirstDose ? actualTime : scheduleStartedAt,
      );

      const draft: MedicationOrderSchedule = {
        ...schedule,
        scheduleStartedAt,
        nextDueAt,
        lastAdministeredAt: actualTime,
        doseSequenceNumber,
        dosesPerDay: new Prisma.Decimal(parsedFreq.dosesPerDay),
        frequencyIntervalHours: new Prisma.Decimal(
          parsedFreq.frequencyIntervalHours,
        ),
        ...durationPatch,
      };

      return {
        scheduleData: {
          scheduleStartedAt,
          nextDueAt,
          lastAdministeredAt: actualTime,
          doseSequenceNumber,
          dosesPerDay: new Prisma.Decimal(parsedFreq.dosesPerDay),
          frequencyIntervalHours: new Prisma.Decimal(
            parsedFreq.frequencyIntervalHours,
          ),
          durationValue: durationPatch.durationValue ?? schedule.durationValue,
          durationUnit: durationPatch.durationUnit ?? schedule.durationUnit,
          courseEndsAt: durationPatch.courseEndsAt ?? schedule.courseEndsAt,
          scheduleStatus: this.recomputeScheduleStatus(
            now,
            draft,
            order.administrationStatus,
          ),
        },
        doseNumber: doseSequenceNumber,
        isFirstDose,
      };
    }

    const draft: MedicationOrderSchedule = { ...schedule };
    const scheduleStatus = this.recomputeScheduleStatus(
      now,
      draft,
      order.administrationStatus,
    );

    return {
      scheduleData: { scheduleStatus },
      doseNumber: null,
      isFirstDose: false,
    };
  }

  async updateScheduleFromDurationChange(
    orderId: string,
    duration: string | null,
    tx?: Tx,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const schedule = await client.medicationOrderSchedule.findUnique({
      where: { medicationOrderId: orderId },
    });
    if (!schedule) return;

    const parsed = parseDuration(duration);
    const patch = this.applyParsedDurationToSchedule(
      schedule,
      parsed,
      schedule.scheduleStartedAt,
    );

    const order = await client.medicationOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { administrationStatus: true },
    });

    const draft = { ...schedule, ...patch };
    await client.medicationOrderSchedule.update({
      where: { id: schedule.id },
      data: {
        ...patch,
        scheduleStatus: this.recomputeScheduleStatus(
          new Date(),
          draft,
          order.administrationStatus,
        ),
      },
    });
  }

  async stopSchedule(orderId: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    const schedule = await client.medicationOrderSchedule.findUnique({
      where: { medicationOrderId: orderId },
      include: {
        medicationOrder: { select: { admissionId: true } },
      },
    });
    if (!schedule) return;

    await client.medicationOrderSchedule.update({
      where: { id: schedule.id },
      data: { scheduleStatus: MedicationScheduleStatus.STOPPED },
    });

    if (schedule.medicationOrder.admissionId) {
      await this.resolveMedicationAlerts(
        schedule.medicationOrder.admissionId,
        orderId,
        client,
      );
    }
  }

  async recordBeyondDurationConsent(params: {
    orderId: string;
    doctorId: string;
    consentNote?: string;
    extendDurationValue?: number;
    extendDurationUnit?: RxDurationUnit;
  }): Promise<MedicationOrderSchedule> {
    const schedule = await this.prisma.medicationOrderSchedule.findUnique({
      where: { medicationOrderId: params.orderId },
      include: {
        medicationOrder: {
          select: {
            admissionId: true,
            administrationStatus: true,
            duration: true,
          },
        },
      },
    });
    if (!schedule) {
      throw new Error(`Schedule not found for order ${params.orderId}`);
    }

    const now = new Date();
    let courseEndsAt = schedule.courseEndsAt;
    let durationValue = schedule.durationValue;
    let durationUnit = schedule.durationUnit;

    if (
      params.extendDurationValue != null &&
      params.extendDurationUnit != null
    ) {
      const base = courseEndsAt ?? now;
      courseEndsAt = addDuration(
        base,
        params.extendDurationValue,
        params.extendDurationUnit,
      );
      if (durationValue != null && durationUnit != null) {
        if (params.extendDurationUnit === durationUnit) {
          durationValue += params.extendDurationValue;
        } else {
          durationValue = params.extendDurationValue;
          durationUnit = params.extendDurationUnit;
        }
      } else {
        durationValue = params.extendDurationValue;
        durationUnit = params.extendDurationUnit;
      }
    }

    const draft: MedicationOrderSchedule = {
      ...schedule,
      beyondDurationConsentAt: now,
      beyondDurationConsentById: params.doctorId,
      beyondDurationConsentNote: params.consentNote?.trim() || null,
      courseEndsAt,
      durationValue,
      durationUnit,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.medicationOrderSchedule.update({
        where: { id: schedule.id },
        data: {
          beyondDurationConsentAt: now,
          beyondDurationConsentById: params.doctorId,
          beyondDurationConsentNote: params.consentNote?.trim() || null,
          courseEndsAt,
          durationValue,
          durationUnit,
          scheduleStatus: this.recomputeScheduleStatus(
            now,
            draft,
            schedule.medicationOrder.administrationStatus,
          ),
        },
      });

      if (schedule.medicationOrder.admissionId) {
        await this.resolveMedicationAlerts(
          schedule.medicationOrder.admissionId,
          params.orderId,
          tx,
          [AdmissionAlertType.MEDICATION_COURSE_EXPIRED],
        );
      }

      return row;
    });

    return updated;
  }

  async syncAlertsForSchedule(
    admissionId: string,
    order: {
      id: string;
      drugName: string;
      dose: string | null;
      frequency: string | null;
    },
    schedule: MedicationOrderSchedule,
    tx?: Tx,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const now = new Date();
    const metadata = {
      drugName: order.drugName,
      dose: order.dose,
      frequency: order.frequency,
      nextDueAt: schedule.nextDueAt?.toISOString() ?? null,
    };

    if (
      schedule.scheduleStatus === MedicationScheduleStatus.DUE_SOON &&
      schedule.nextDueAt
    ) {
      await this.upsertMedicationAlert(client, {
        admissionId,
        medicationOrderId: order.id,
        type: AdmissionAlertType.MEDICATION_DOSE_DUE,
        severity: AlertSeverity.MEDIUM,
        title: 'Medication dose due',
        message: `${order.drugName} — dose due at ${schedule.nextDueAt.toISOString()}`,
        dueAt: schedule.nextDueAt,
        metadata,
      });
      await this.resolveMedicationAlerts(admissionId, order.id, client, [
        AdmissionAlertType.MEDICATION_DOSE_OVERDUE,
        AdmissionAlertType.MEDICATION_COURSE_EXPIRED,
      ]);
      return;
    }

    if (
      schedule.scheduleStatus === MedicationScheduleStatus.OVERDUE &&
      schedule.nextDueAt
    ) {
      await this.upsertMedicationAlert(client, {
        admissionId,
        medicationOrderId: order.id,
        type: AdmissionAlertType.MEDICATION_DOSE_OVERDUE,
        severity: AlertSeverity.HIGH,
        title: 'Medication dose overdue',
        message: `${order.drugName} — dose was due at ${schedule.nextDueAt.toISOString()}`,
        dueAt: schedule.nextDueAt,
        metadata,
      });
      await this.resolveMedicationAlerts(admissionId, order.id, client, [
        AdmissionAlertType.MEDICATION_DOSE_DUE,
      ]);
      return;
    }

    if (schedule.scheduleStatus === MedicationScheduleStatus.EXPIRED) {
      await this.upsertMedicationAlert(client, {
        admissionId,
        medicationOrderId: order.id,
        type: AdmissionAlertType.MEDICATION_COURSE_EXPIRED,
        severity: AlertSeverity.CRITICAL,
        title: 'Medication course expired',
        message: `${order.drugName} — prescribed course has ended`,
        dueAt: schedule.courseEndsAt,
        metadata,
      });
      return;
    }

    await this.resolveMedicationAlerts(
      admissionId,
      order.id,
      client,
      [...MEDICATION_ALERT_TYPES],
    );
  }

  private async upsertMedicationAlert(
    client: Tx | PrismaService,
    params: {
      admissionId: string;
      medicationOrderId: string;
      type: AdmissionAlertType;
      severity: AlertSeverity;
      title: string;
      message: string;
      dueAt: Date | null;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    const existing = await client.alertLog.findFirst({
      where: {
        admissionId: params.admissionId,
        medicationOrderId: params.medicationOrderId,
        type: params.type,
        resolved: false,
      },
    });

    if (existing) {
      await client.alertLog.update({
        where: { id: existing.id },
        data: {
          severity: params.severity,
          message: params.message,
          dueAt: params.dueAt,
          metadata: params.metadata as Prisma.InputJsonValue,
        },
      });
      return;
    }

    await client.alertLog.create({
      data: {
        admissionId: params.admissionId,
        medicationOrderId: params.medicationOrderId,
        type: params.type,
        alertType: params.type,
        severity: params.severity,
        message: params.message,
        dueAt: params.dueAt,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveMedicationAlerts(
    admissionId: string,
    medicationOrderId: string,
    client: Tx | PrismaService,
    types: AdmissionAlertType[] = [...MEDICATION_ALERT_TYPES],
  ): Promise<void> {
    await client.alertLog.updateMany({
      where: {
        admissionId,
        medicationOrderId,
        type: { in: types },
        resolved: false,
      },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  async listDoseSchedulesForAdmission(
    admissionId: string,
    activeOnly = true,
    dueOnly = false,
  ): Promise<{ items: MedicationDoseScheduleItemApi[] }> {
    await this.prisma.admission.findUniqueOrThrow({
      where: { id: admissionId },
      select: { id: true },
    });

    const orders = await this.prisma.medicationOrder.findMany({
      where: {
        ...medicationOrdersForAdmissionWhere(admissionId),
        ...(activeOnly && {
          administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
        }),
        ...(dueOnly && {
          doseSchedule: {
            scheduleStatus: {
              in: [
                MedicationScheduleStatus.DUE_SOON,
                MedicationScheduleStatus.OVERDUE,
              ],
            },
          },
        }),
      },
      include: { doseSchedule: true },
      orderBy: { doseSchedule: { nextDueAt: 'asc' } },
    });

    return {
      items: orders.map((order) => this.mapOrderToScheduleItem(order)),
    };
  }

  async processActiveSchedulesForAlerts(): Promise<{
    processed: number;
    updated: number;
  }> {
    const schedules = await this.prisma.medicationOrderSchedule.findMany({
      where: {
        medicationOrder: {
          administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
          admissionId: { not: null },
        },
        scheduleStatus: {
          not: MedicationScheduleStatus.STOPPED,
        },
      },
      include: {
        medicationOrder: {
          select: {
            id: true,
            admissionId: true,
            drugName: true,
            dose: true,
            frequency: true,
            administrationStatus: true,
          },
        },
      },
    });

    const now = new Date();
    let updated = 0;

    for (const schedule of schedules) {
      const admissionId = schedule.medicationOrder.admissionId;
      if (!admissionId) continue;

      const nextStatus = this.recomputeScheduleStatus(
        now,
        schedule,
        schedule.medicationOrder.administrationStatus,
      );

      if (nextStatus !== schedule.scheduleStatus) {
        await this.prisma.medicationOrderSchedule.update({
          where: { id: schedule.id },
          data: { scheduleStatus: nextStatus },
        });
        schedule.scheduleStatus = nextStatus;
        updated += 1;
      }

      await this.syncAlertsForSchedule(
        admissionId,
        schedule.medicationOrder,
        schedule,
      );
    }

    return { processed: schedules.length, updated };
  }

  async backfillSchedulesFromAdministrations(): Promise<number> {
    const orders = await this.prisma.medicationOrder.findMany({
      where: {
        admissionId: { not: null },
        administrations: {
          some: { status: MedicationAdminStatus.GIVEN },
        },
      },
      include: {
        doseSchedule: true,
        administrations: {
          where: { status: MedicationAdminStatus.GIVEN },
          orderBy: { actualTime: 'asc' },
        },
      },
    });

    let count = 0;
    for (const order of orders) {
      const givenRows = order.administrations.filter((a) => a.actualTime);
      if (givenRows.length === 0) continue;

      const first = givenRows[0]!;
      const last = givenRows[givenRows.length - 1]!;
      const actualFirst = first.actualTime!;
      const actualLast = last.actualTime!;

      const schedule =
        order.doseSchedule ??
        (await this.ensureScheduleForOrder(order.id, undefined, {
          frequency: order.frequency,
          duration: order.duration,
        }));

      const parsedFreq = parseFrequency(order.frequency);
      const parsedDuration = parseDuration(order.duration);
      const durationPatch = this.applyParsedDurationToSchedule(
        schedule,
        parsedDuration,
        actualFirst,
      );

      const draft: MedicationOrderSchedule = {
        ...schedule,
        scheduleStartedAt: actualFirst,
        lastAdministeredAt: actualLast,
        doseSequenceNumber: givenRows.length,
        nextDueAt: computeNextDueAt(actualLast, parsedFreq),
        dosesPerDay: new Prisma.Decimal(parsedFreq.dosesPerDay),
        frequencyIntervalHours: new Prisma.Decimal(
          parsedFreq.frequencyIntervalHours,
        ),
        ...durationPatch,
      };

      await this.prisma.medicationOrderSchedule.update({
        where: { id: schedule.id },
        data: {
          scheduleStartedAt: actualFirst,
          lastAdministeredAt: actualLast,
          doseSequenceNumber: givenRows.length,
          nextDueAt: computeNextDueAt(actualLast, parsedFreq),
          dosesPerDay: new Prisma.Decimal(parsedFreq.dosesPerDay),
          frequencyIntervalHours: new Prisma.Decimal(
            parsedFreq.frequencyIntervalHours,
          ),
          durationValue: durationPatch.durationValue ?? schedule.durationValue,
          durationUnit: durationPatch.durationUnit ?? schedule.durationUnit,
          courseEndsAt: durationPatch.courseEndsAt ?? schedule.courseEndsAt,
          scheduleStatus: this.recomputeScheduleStatus(
            new Date(),
            draft,
            order.administrationStatus,
          ),
        },
      });
      count += 1;
    }

    this.logger.log(`Backfilled ${count} medication order schedule(s)`);
    return count;
  }

  async queryDueMedications(nursingUnitWardId?: string | null): Promise<
    Array<{
      admissionId: string;
      title: string | null;
      firstName: string | null;
      otherName: string | null;
      surname: string | null;
      displayName: string;
      patientName: string | null;
      wardBed: string;
      medicationOrderId: string;
      drugName: string;
      scheduleStatus: MedicationScheduleStatus;
      nextDueAt: string;
      minutesOverdue: number;
    }>
  > {
    const now = new Date();
    const schedules = await this.prisma.medicationOrderSchedule.findMany({
      where: {
        scheduleStatus: {
          in: [
            MedicationScheduleStatus.DUE_SOON,
            MedicationScheduleStatus.OVERDUE,
          ],
        },
        nextDueAt: { not: null },
        medicationOrder: {
          administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
          admissionId: { not: null },
          ...(nursingUnitWardId
            ? { admission: { wardId: nursingUnitWardId } }
            : {}),
        },
      },
      include: {
        medicationOrder: {
          select: {
            id: true,
            drugName: true,
            admissionId: true,
            admission: {
              select: {
                id: true,
                ward: true,
                wardEntity: { select: { name: true } },
                bed: { select: { bedNumber: true } },
                patient: { select: patientNameFieldsSelect },
              },
            },
          },
        },
      },
      orderBy: { nextDueAt: 'asc' },
      take: 50,
    });

    return schedules
      .map((s) => {
        const admission = s.medicationOrder.admission;
        if (!admission || !s.nextDueAt) return null;
        const wardName =
          admission.wardEntity?.name ?? admission.ward ?? 'Ward';
        const bedLabel = admission.bed?.bedNumber
          ? `Bed ${admission.bed.bedNumber}`
          : null;
        const minutesOverdue = Math.max(
          0,
          Math.floor((now.getTime() - s.nextDueAt.getTime()) / 60000),
        );
        return {
          admissionId: admission.id,
          ...toPatientNameWithLegacyKey(admission.patient, 'patientName'),
          wardBed: bedLabel ? `${wardName} / ${bedLabel}` : wardName,
          medicationOrderId: s.medicationOrder.id,
          drugName: s.medicationOrder.drugName,
          scheduleStatus: s.scheduleStatus,
          nextDueAt: s.nextDueAt.toISOString(),
          minutesOverdue,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }
}
