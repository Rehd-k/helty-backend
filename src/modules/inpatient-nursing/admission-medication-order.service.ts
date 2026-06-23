import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MedicationAdministrationLifecycleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MedicationScheduleService } from '../medication-schedule/medication-schedule.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
} from './inpatient-nursing.utils';
import {
  CreateAdmissionMedicationOrderDto,
  UpdateAdmissionMedicationOrderDto,
} from './dto/admission-medication.dto';
import {
  medicationOrderForAdmissionWhere,
  medicationOrdersForAdmissionWhere,
} from './admission-medication-order.util';

@Injectable()
export class AdmissionMedicationOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly medicationScheduleService: MedicationScheduleService,
  ) {}

  private withPrescriber(order: any) {
    const { doctor, doseSchedule, ...rest } = order;
    return {
      ...rest,
      prescribedBy: doctor ?? null,
      doseSchedule: doseSchedule
        ? this.medicationScheduleService.mapScheduleToApi(doseSchedule)
        : null,
    };
  }

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    const rows = await this.prisma.medicationOrder.findMany({
      where: medicationOrdersForAdmissionWhere(admissionId),
      orderBy: { startDateTime: 'desc' },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true },
        },
        doseSchedule: true,
      },
    });
    return rows.map((row) => this.withPrescriber(row));
  }

  async create(
    admissionId: string,
    dto: CreateAdmissionMedicationOrderDto,
    prescribedByDoctorId: string,
  ) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: admissionId },
      select: {
        id: true,
        status: true,
        patientId: true,
        encounter: { select: { id: true } },
      },
    });
    if (!admission) {
      throw new NotFoundException(`Admission "${admissionId}" not found.`);
    }
    assertAdmissionWritable(admission);
    if (!admission.encounter?.id) {
      throw new BadRequestException(
        'Admission is not linked to an encounter; medication order cannot be created.',
      );
    }

    const doctor = await this.prisma.staff.findUnique({
      where: { id: prescribedByDoctorId },
    });
    if (!doctor) {
      throw new NotFoundException(
        `Prescribing doctor "${prescribedByDoctorId}" not found.`,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.medicationOrder.create({
        data: {
          encounterId: admission.encounter!.id,
          admissionId,
          patientId: admission.patientId,
          doctorId: prescribedByDoctorId,
          administrationStatus: 'ACTIVE',
          drugName: dto.drugName.trim(),
          dose: dto.dose.trim(),
          quantity: new Prisma.Decimal(dto.quantity ?? 1),
          route: dto.route,
          frequency: dto.frequency.trim(),
          duration: dto.duration?.trim() || null,
          startDateTime: new Date(dto.startDateTime),
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
          notes: dto.notes?.trim() || null,
        },
      });

      await this.medicationScheduleService.ensureScheduleForOrder(
        created.id,
        tx,
        { frequency: dto.frequency, duration: dto.duration },
      );

      return tx.medicationOrder.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          doctor: {
            select: { id: true, firstName: true, lastName: true },
          },
          doseSchedule: true,
        },
      });
    });
    return this.withPrescriber(row);
  }

  async update(
    admissionId: string,
    orderId: string,
    dto: UpdateAdmissionMedicationOrderDto,
  ) {
    const order = await this.prisma.medicationOrder.findFirst({
      where: medicationOrderForAdmissionWhere(orderId, admissionId),
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order "${orderId}" not found for this admission.`,
      );
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.medicationOrder.update({
        where: { id: orderId },
        data: {
          ...(dto.administrationStatus !== undefined && {
            administrationStatus: dto.administrationStatus,
          }),
          ...(dto.dose !== undefined && { dose: dto.dose }),
          ...(dto.quantity !== undefined && {
            quantity: new Prisma.Decimal(dto.quantity),
          }),
          ...(dto.frequency !== undefined && { frequency: dto.frequency }),
          ...(dto.duration !== undefined && {
            duration: dto.duration?.trim() || null,
          }),
          ...(dto.endDateTime !== undefined && {
            endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      if (dto.duration !== undefined) {
        await this.medicationScheduleService.updateScheduleFromDurationChange(
          orderId,
          dto.duration ?? null,
          tx,
        );
      }

      if (
        dto.administrationStatus ===
        MedicationAdministrationLifecycleStatus.STOPPED
      ) {
        await this.medicationScheduleService.stopSchedule(orderId, tx);
      }

      return tx.medicationOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          doctor: {
            select: { id: true, firstName: true, lastName: true },
          },
          doseSchedule: true,
        },
      });
    });
    return this.withPrescriber(row);
  }

  async remove(admissionId: string, orderId: string) {
    const order = await this.prisma.medicationOrder.findFirst({
      where: medicationOrderForAdmissionWhere(orderId, admissionId),
      include: { _count: { select: { administrations: true } } },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order "${orderId}" not found for this admission.`,
      );
    }
    if (order._count.administrations > 0) {
      throw new BadRequestException(
        'Cannot delete an order that already has administration records.',
      );
    }
    await this.prisma.medicationOrder.delete({ where: { id: orderId } });
  }
}
