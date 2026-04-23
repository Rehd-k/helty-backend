import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
  isSuperAdminStaff,
} from './inpatient-nursing.utils';
import {
  CreateMedicationAdministrationDto,
  UpdateMedicationAdministrationDto,
} from './dto/admission-medication.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

const medicationOrderSelect = {
  id: true,
  drugName: true,
  dose: true,
  route: true,
  frequency: true,
} as const;

@Injectable()
export class MedicationAdministrationService {
  constructor(private readonly prisma: PrismaService) { }

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.medicationAdministration.findMany({
      where: { admissionId },
      orderBy: { scheduledTime: 'desc' },
      include: {
        medicationOrder: { select: medicationOrderSelect },
        nurse: { select: nurseSelect },
      },
    });
  }

  async create(
    admissionId: string,
    dto: CreateMedicationAdministrationDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);

    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    const order = await this.prisma.medicationOrder.findFirst({
      where: { id: dto.medicationOrderId },
    });
    if (!order) {
      throw new BadRequestException(
        'Medication order does not belong to this admission.',
      );
    }
    console.log(dto, admissionId, staffId);
    return this.prisma.medicationAdministration.create({
      data: {
        admissionId,
        medicationOrderId: dto.medicationOrderId,
        administeredByNurseId: staffId,
        scheduledTime: new Date(dto.scheduledTime),
        actualTime: dto.actualTime ? new Date(dto.actualTime) : null,
        status: dto.status,
        reasonIfNotGiven: dto.reasonIfNotGiven?.trim() || null,
        remarks: dto.remarks?.trim() || null,
      },
      include: {
        medicationOrder: { select: medicationOrderSelect },
        nurse: { select: nurseSelect },
      },
    });
  }

  async update(
    admissionId: string,
    administrationId: string,
    dto: UpdateMedicationAdministrationDto,
    staffId: string,
  ) {
    const actor = await assertStaffIsNurseOrThrow(this.prisma, staffId);

    const row = await this.prisma.medicationAdministration.findFirst({
      where: { id: administrationId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Medication administration not found.');
    }
    if (
      row.administeredByNurseId !== staffId &&
      !isSuperAdminStaff(actor)
    ) {
      throw new BadRequestException(
        'Only the recording nurse can update this administration.',
      );
    }

    return this.prisma.medicationAdministration.update({
      where: { id: administrationId },
      data: {
        ...(dto.actualTime !== undefined && {
          actualTime: dto.actualTime ? new Date(dto.actualTime) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.reasonIfNotGiven !== undefined && {
          reasonIfNotGiven: dto.reasonIfNotGiven,
        }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
      },
      include: {
        medicationOrder: { select: medicationOrderSelect },
        nurse: { select: nurseSelect },
      },
    });
  }
}
