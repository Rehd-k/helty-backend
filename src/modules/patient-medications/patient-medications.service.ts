import {
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
import {
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
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(user: PatientJwtPayload) {
    const now = new Date();
    const todayStart = getHospitalDayStart(now);
    const todayEnd = getHospitalDayEnd(now);
    const nextWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [nextDoses, todaySchedule, activePrescriptions] = await Promise.all([
      this.prisma.patientMedicationDoseLog.findMany({
        where: {
          patientId: user.sub,
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
          patientId: user.sub,
          scheduledAt: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        orderBy: { scheduledAt: 'asc' },
        include: DOSE_LOG_INCLUDE,
      }),
      this.prisma.prescription.findMany({
        where: buildActivePrescriptionWhere(user.sub, now),
        include: ACTIVE_PRESCRIPTION_INCLUDE,
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return {
      nextDoses: nextDoses.map((dose) => toMedicationDoseSummaryDto(dose)),
      todaySchedule: todaySchedule.map((dose) =>
        toMedicationScheduleEntryDto(dose),
      ),
      activePrescriptions: activePrescriptions.map((prescription) =>
        toActivePrescriptionSummaryDto(prescription, now),
      ),
    };
  }

  async markDoseTaken(
    user: PatientJwtPayload,
    doseId: string,
    dto?: MarkDoseTakenDto,
  ) {
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

    if (dose.prescriptionItem.prescription.patientId !== user.sub) {
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
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      takenAt: updated.takenAt!,
    };
  }

  async listPrescriptionHistory(
    user: PatientJwtPayload,
    query: ListPrescriptionsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const statuses = query.status?.length
      ? query.status
      : DEFAULT_HISTORY_STATUSES;

    const where = {
      patientId: user.sub,
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
  ) {
    const now = new Date();
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        ...buildActivePrescriptionWhere(user.sub, now),
      },
    });

    if (!prescription) {
      const exists = await this.prisma.prescription.findUnique({
        where: { id: prescriptionId },
        select: { patientId: true },
      });
      if (!exists) {
        throw new NotFoundException(`Prescription "${prescriptionId}" not found.`);
      }
      if (exists.patientId !== user.sub) {
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
        patientId: user.sub,
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
