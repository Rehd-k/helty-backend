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

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.admissionMedicationOrder.findMany({
      where: { admissionId },
      orderBy: { startDateTime: 'desc' },
      include: {
        prescribedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(
    admissionId: string,
    dto: CreateAdmissionMedicationOrderDto,
    prescribedByDoctorId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);

    const doctor = await this.prisma.staff.findUnique({
      where: { id: prescribedByDoctorId },
    });
    if (!doctor) {
      throw new NotFoundException(
        `Prescribing doctor "${prescribedByDoctorId}" not found.`,
      );
    }

    return this.prisma.admissionMedicationOrder.create({
      data: {
        admissionId,
        prescribedByDoctorId,
        drugName: dto.drugName.trim(),
        dose: dto.dose.trim(),
        route: dto.route,
        frequency: dto.frequency.trim(),
        startDateTime: new Date(dto.startDateTime),
        endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        prescribedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(
    admissionId: string,
    orderId: string,
    dto: UpdateAdmissionMedicationOrderDto,
  ) {
    const order = await this.prisma.admissionMedicationOrder.findFirst({
      where: { id: orderId, admissionId },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order "${orderId}" not found for this admission.`,
      );
    }
    return this.prisma.admissionMedicationOrder.update({
      where: { id: orderId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dose !== undefined && { dose: dto.dose }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.endDateTime !== undefined && {
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        prescribedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async remove(admissionId: string, orderId: string) {
    const order = await this.prisma.admissionMedicationOrder.findFirst({
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
    await this.prisma.admissionMedicationOrder.delete({ where: { id: orderId } });
  }
}
