import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PatientMedicationDoseStatus,
  PrescriptionRefillRequestStatus,
  PrescriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import {
  DEFAULT_HISTORY_STATUSES,
  ListPrescriptionsQueryDto,
} from './dto/list-prescriptions-query.dto';
import { MarkDoseTakenDto } from './dto/mark-dose-taken.dto';
import { RefillRequestDto } from './dto/refill-request.dto';
import {
  ACTIVE_PRESCRIPTION_INCLUDE,
  buildActivePrescriptionWhere,
  DOSE_LOG_INCLUDE,
} from './patient-medications.constants';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';
import { MedicationOrderPrescriptionSyncService } from './medication-order-prescription.sync';
import {
  buildDisplayName,
  getHospitalDayEnd,
  getHospitalDayStart,
  toActivePrescriptionSummaryDto,
  toMedicationDoseSummaryDto,
  toMedicationScheduleEntryDto,
  toPrescriptionHistorySummaryDto,
} from './patient-medications.util';

const HISTORY_INCLUDE = {
  doctor: { select: { firstName: true, lastName: true } },
  items: {
    where: { itemType: 'DRUG' as const },
    take: 1,
    include: {
      drug: { select: { brandName: true, genericName: true, strength: true } },
    },
  },
} as const;

@Injectable()
export class PatientMedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doseGenerator: PatientMedicationDoseGeneratorService,
    private readonly orderPrescriptionSync: MedicationOrderPrescriptionSyncService,
    private readonly family: PatientFamilyService,
  ) {}

  async getDashboard(user: PatientJwtPayload, forPatientId?: string) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const now = new Date();
    const todayStart = getHospitalDayStart(now);
    const todayEnd = getHospitalDayEnd(now);
    const nextWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await this.orderPrescriptionSync.syncDispensedOutpatientOrdersForPatient(
      subjectId,
    );

    const [initialDoseData, activePrescriptions] = await Promise.all([
      this.fetchDashboardDoseData(subjectId, todayStart, todayEnd, nextWindowEnd),
      this.prisma.prescription.findMany({
        where: buildActivePrescriptionWhere(subjectId, todayEnd),
        include: {
          ...ACTIVE_PRESCRIPTION_INCLUDE,
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    let doseData = initialDoseData;

    if (
      !doseData.nextDoses.length &&
      !doseData.todaySchedule.length &&
      activePrescriptions.length
    ) {
      await Promise.all(
        activePrescriptions.map((prescription) =>
          this.doseGenerator.generateDosesForPrescription(prescription.id),
        ),
      );
      doseData = await this.fetchDashboardDoseData(
        subjectId,
        todayStart,
        todayEnd,
        nextWindowEnd,
      );
    }

    return {
      nextDoses: doseData.nextDoses.map((dose) =>
        toMedicationDoseSummaryDto(dose),
      ),
      todaySchedule: doseData.todaySchedule.map((dose) =>
        toMedicationScheduleEntryDto(dose),
      ),
      activePrescriptions: activePrescriptions.map((prescription) =>
        toActivePrescriptionSummaryDto(
          {
            id: prescription.id,
            endDate: prescription.endDate,
            startDate: prescription.startDate,
            patientScheduleStartAt: prescription.patientScheduleStartAt,
            scheduleConfirmedAt: prescription.scheduleConfirmedAt,
            refillsAllowed: prescription.refillsAllowed,
            items: prescription.items,
          },
          now,
        ),
      ),
    };
  }

  async getCalendar(
    user: PatientJwtPayload,
    from: Date,
    to: Date,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    if (to.getTime() < from.getTime()) {
      throw new BadRequestException('`to` must be on or after `from`.');
    }

    const doses = await this.prisma.patientMedicationDoseLog.findMany({
      where: {
        patientId: subjectId,
        scheduledAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { scheduledAt: 'asc' },
      include: DOSE_LOG_INCLUDE,
    });

    return {
      doses: doses.map((dose) => toMedicationScheduleEntryDto(dose)),
    };
  }

  async getPrescriptionDoses(
    user: PatientJwtPayload,
    prescriptionId: string,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );

    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: subjectId },
      include: {
        items: {
          where: { itemType: 'DRUG' },
          include: {
            drug: {
              select: { brandName: true, genericName: true, strength: true },
            },
            doseLogs: {
              orderBy: { scheduledAt: 'asc' },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription "${prescriptionId}" not found.`);
    }

    const primaryItem = prescription.items[0];
    const doses = prescription.items.flatMap((item) =>
      item.doseLogs.map((dose) =>
        toMedicationScheduleEntryDto({
          id: dose.id,
          prescriptionItemId: dose.prescriptionItemId,
          scheduledAt: dose.scheduledAt,
          timeOfDay: dose.timeOfDay,
          status: dose.status,
          prescriptionItem: {
            dosage: item.dosage,
            instructions: item.instructions,
            drug: item.drug,
          },
        }),
      ),
    );

    doses.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    return {
      prescriptionId: prescription.id,
      displayName: primaryItem
        ? buildDisplayName(primaryItem)
        : 'Prescription',
      doses,
    };
  }

  private async fetchDashboardDoseData(
    patientId: string,
    todayStart: Date,
    todayEnd: Date,
    nextWindowEnd: Date,
  ) {
    const [nextDoses, todaySchedule] = await Promise.all([
      this.prisma.patientMedicationDoseLog.findMany({
        where: {
          patientId,
          status: PatientMedicationDoseStatus.UPCOMING,
          scheduledAt: {
            gte: todayStart,
            lte: nextWindowEnd,
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        include: DOSE_LOG_INCLUDE,
      }),
      this.prisma.patientMedicationDoseLog.findMany({
        where: {
          patientId,
          scheduledAt: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        orderBy: { scheduledAt: 'asc' },
        include: DOSE_LOG_INCLUDE,
      }),
    ]);

    return { nextDoses, todaySchedule };
  }

  async markDoseTaken(
    user: PatientJwtPayload,
    doseId: string,
    dto?: MarkDoseTakenDto,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );

    const dose = await this.prisma.patientMedicationDoseLog.findUnique({
      where: { id: doseId },
      include: {
        prescriptionItem: {
          include: {
            prescription: { select: { patientId: true } },
          },
        },
      },
    });

    if (!dose) {
      throw new NotFoundException(`Dose "${doseId}" not found.`);
    }

    if (dose.prescriptionItem.prescription.patientId !== subjectId) {
      throw new ForbiddenException('You do not have access to this dose.');
    }

    if (
      dose.status === PatientMedicationDoseStatus.TAKEN ||
      dose.status === PatientMedicationDoseStatus.SKIPPED
    ) {
      throw new ConflictException('Dose is already taken or skipped.');
    }

    const takenAt = dto?.takenAt ?? new Date();
    const updated = await this.prisma.patientMedicationDoseLog.update({
      where: { id: doseId },
      data: {
        status: PatientMedicationDoseStatus.TAKEN,
        takenAt,
        missedAt: null,
      },
    });

    const prescriptionId = await this.prisma.prescriptionItem.findUnique({
      where: { id: dose.prescriptionItemId },
      select: { prescriptionId: true, prescription: { select: { scheduleConfirmedAt: true } } },
    });
    if (prescriptionId && !prescriptionId.prescription.scheduleConfirmedAt) {
      await this.prisma.prescription.update({
        where: { id: prescriptionId.prescriptionId },
        data: { scheduleConfirmedAt: takenAt },
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      takenAt: updated.takenAt!,
    };
  }

  async setScheduleStart(
    user: PatientJwtPayload,
    prescriptionId: string,
    startAt: Date,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const prescription = await this.assertEditableSchedule(
      subjectId,
      prescriptionId,
    );

    const now = new Date();
    if (startAt.getTime() < now.getTime() - 60 * 1000) {
      throw new BadRequestException('Start time cannot be in the past.');
    }

    const endDate = prescription.endDate;
    let nextEndDate = endDate;
    if (prescription.startDate && endDate) {
      const durationMs =
        endDate.getTime() - prescription.startDate.getTime();
      nextEndDate = new Date(startAt.getTime() + Math.max(durationMs, 0));
    }

    await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        patientScheduleStartAt: startAt,
        scheduleConfirmedAt: now,
        endDate: nextEndDate,
      },
    });

    const dosesGenerated =
      await this.doseGenerator.regenerateUpcomingDoses(prescriptionId);

    const updated = await this.prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      select: {
        id: true,
        patientScheduleStartAt: true,
        scheduleConfirmedAt: true,
      },
    });

    return {
      id: updated.id,
      patientScheduleStartAt: updated.patientScheduleStartAt,
      scheduleConfirmedAt: updated.scheduleConfirmedAt,
      dosesGenerated,
    };
  }

  async confirmSchedule(
    user: PatientJwtPayload,
    prescriptionId: string,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const prescription = await this.assertEditableSchedule(
      subjectId,
      prescriptionId,
    );

    const now = new Date();
    await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        scheduleConfirmedAt: now,
        patientScheduleStartAt:
          prescription.patientScheduleStartAt ??
          prescription.startDate ??
          now,
      },
    });

    const dosesGenerated =
      await this.doseGenerator.generateDosesForPrescription(prescriptionId);

    const updated = await this.prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      select: {
        id: true,
        patientScheduleStartAt: true,
        scheduleConfirmedAt: true,
      },
    });

    return {
      id: updated.id,
      patientScheduleStartAt: updated.patientScheduleStartAt,
      scheduleConfirmedAt: updated.scheduleConfirmedAt,
      dosesGenerated,
    };
  }

  private async assertEditableSchedule(
    subjectId: string,
    prescriptionId: string,
  ) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: subjectId },
      include: {
        items: {
          where: { itemType: 'DRUG', quantityDispensed: { gt: 0 } },
          select: {
            id: true,
            doseLogs: {
              where: { status: PatientMedicationDoseStatus.TAKEN },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription "${prescriptionId}" not found.`);
    }

    if (!prescription.items.length) {
      throw new BadRequestException(
        'Prescription has not been dispensed yet.',
      );
    }

    const hasTaken = prescription.items.some(
      (item) => item.doseLogs.length > 0,
    );
    if (hasTaken) {
      throw new ConflictException(
        'Cannot change schedule after a dose has been taken.',
      );
    }

    return prescription;
  }

  async listPrescriptionHistory(
    user: PatientJwtPayload,
    query: ListPrescriptionsQueryDto,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      query.forPatientId,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const statuses = query.status?.length
      ? query.status
      : DEFAULT_HISTORY_STATUSES;

    const where = {
      patientId: subjectId,
      status: { in: statuses as PrescriptionStatus[] },
    };

    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { endDate: 'desc' },
        include: HISTORY_INCLUDE,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      data: prescriptions.map(toPrescriptionHistorySummaryDto),
      total,
      page,
      limit,
    };
  }

  async createRefillRequest(
    user: PatientJwtPayload,
    prescriptionId: string,
    dto?: RefillRequestDto,
    forPatientId?: string,
  ) {
    const subjectId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const now = new Date();
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        ...buildActivePrescriptionWhere(subjectId, getHospitalDayEnd(now)),
      },
    });

    if (!prescription) {
      const exists = await this.prisma.prescription.findUnique({
        where: { id: prescriptionId },
        select: { patientId: true },
      });
      if (!exists) {
        throw new NotFoundException(
          `Prescription "${prescriptionId}" not found.`,
        );
      }
      if (exists.patientId !== subjectId) {
        throw new ForbiddenException(
          'You do not have access to this prescription.',
        );
      }
      throw new NotFoundException(
        `Prescription "${prescriptionId}" is not active.`,
      );
    }

    const pending = await this.prisma.prescriptionRefillRequest.findFirst({
      where: {
        prescriptionId,
        status: PrescriptionRefillRequestStatus.PENDING,
      },
    });

    if (pending) {
      throw new ConflictException(
        'A pending refill request already exists for this prescription.',
      );
    }

    const request = await this.prisma.prescriptionRefillRequest.create({
      data: {
        prescriptionId,
        patientId: subjectId,
        notes: dto?.notes?.trim() || null,
      },
    });

    return {
      id: request.id,
      prescriptionId: request.prescriptionId,
      status: request.status,
      createdAt: request.createdAt,
    };
  }
}
