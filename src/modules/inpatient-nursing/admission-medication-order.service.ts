import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
} from './inpatient-nursing.utils';
import {
  CreateAdmissionMedicationOrderDto,
  UpdateAdmissionMedicationOrderDto,
} from './dto/admission-medication.dto';

@Injectable()
export class AdmissionMedicationOrderService {
  constructor(private readonly prisma: PrismaService) {}

  private withPrescriber(order: any) {
    const { doctor, ...rest } = order;
    return { ...rest, prescribedBy: doctor ?? null };
  }

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    const rows = await this.prisma.medicationOrder.findMany({
      where: { admissionId },
      orderBy: { startDateTime: 'desc' },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true },
        },
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
      select: { id: true, status: true, patientId: true, encounter: { select: { id: true } } },
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

    const row = await this.prisma.medicationOrder.create({
      data: {
        encounterId: admission.encounter.id,
        admissionId,
        patientId: admission.patientId,
        doctorId: prescribedByDoctorId,
        administrationStatus: 'ACTIVE',
        drugName: dto.drugName.trim(),
        dose: dto.dose.trim(),
        route: dto.route,
        frequency: dto.frequency.trim(),
        startDateTime: new Date(dto.startDateTime),
        endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return this.withPrescriber(row);
  }

  async update(
    admissionId: string,
    orderId: string,
    dto: UpdateAdmissionMedicationOrderDto,
  ) {
    const order = await this.prisma.medicationOrder.findFirst({
      where: { id: orderId, admissionId },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order "${orderId}" not found for this admission.`,
      );
    }
    const row = await this.prisma.medicationOrder.update({
      where: { id: orderId },
      data: {
        ...(dto.administrationStatus !== undefined && {
          administrationStatus: dto.administrationStatus,
        }),
        ...(dto.dose !== undefined && { dose: dto.dose }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.endDateTime !== undefined && {
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return this.withPrescriber(row);
  }

  async remove(admissionId: string, orderId: string) {
    const order = await this.prisma.medicationOrder.findFirst({
      where: { id: orderId, admissionId },
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
