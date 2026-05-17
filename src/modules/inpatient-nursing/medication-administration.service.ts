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
import { MedicationAdminStatus, Prisma } from '@prisma/client';
import {
  CreateMedicationAdministrationDto,
  UpdateMedicationAdministrationDto,
} from './dto/admission-medication.dto';
import {
  computeIsOverMedication,
  resolveOrderedQuantity,
  toAdministrationQuantity,
} from './medication-administration.utils';

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
  quantity: true,
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

    // console.log(order)


    const { quantity, isOverMedication } = this.buildAdministrationQuantityFields(
      order,
      dto.status,
      dto.quantity,
    );
    // console.log(quantity, dto, isOverMedication)

    return this.prisma.medicationAdministration.create({
      data: {
        admissionId,
        medicationOrderId: dto.medicationOrderId,
        administeredByNurseId: staffId,
        scheduledTime: new Date(dto.scheduledTime),
        actualTime: dto.actualTime ? new Date(dto.actualTime) : null,
        status: dto.status,
        quantity,
        isOverMedication,
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
      include: {
        medicationOrder: { select: { quantity: true, dose: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Medication administration not found.');
    }
    if (row.administeredByNurseId !== staffId && !isSuperAdminStaff(actor)) {
      throw new BadRequestException(
        'Only the recording nurse can update this administration.',
      );
    }

    const nextStatus = dto.status ?? row.status;
    const quantityPatch =
      dto.quantity !== undefined || dto.status !== undefined
        ? this.buildAdministrationQuantityFields(
          row.medicationOrder,
          nextStatus,
          dto.quantity !== undefined ? dto.quantity : row.quantity != null ? Number(row.quantity) : undefined,
        )
        : null;

    return this.prisma.medicationAdministration.update({
      where: { id: administrationId },
      data: {
        ...(dto.actualTime !== undefined && {
          actualTime: dto.actualTime ? new Date(dto.actualTime) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(quantityPatch && {
          quantity: quantityPatch.quantity,
          isOverMedication: quantityPatch.isOverMedication,
        }),
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

  private buildAdministrationQuantityFields(
    order: { quantity: Prisma.Decimal | null; dose: string | null },
    status: MedicationAdminStatus,
    quantityInput?: number,
  ): { quantity: ReturnType<typeof toAdministrationQuantity>; isOverMedication: boolean } {
    if (status === MedicationAdminStatus.GIVEN) {
      if (quantityInput === undefined || quantityInput === null) {
        throw new BadRequestException(
          'quantity is required when recording administration as GIVEN.',
        );
      }
      const ordered = resolveOrderedQuantity(order);
      if (ordered == null) {
        throw new BadRequestException(
          'Cannot record administration: the medication order has no ordered quantity. Set quantity on the order or use a numeric dose (e.g. "2 tablets").',
        );
      }
      const administered = toAdministrationQuantity(status, quantityInput)!;
      return {
        quantity: administered,
        isOverMedication: computeIsOverMedication(administered, ordered),
      };
    }

    if (quantityInput !== undefined && quantityInput !== null) {
      throw new BadRequestException(
        'quantity should only be provided when status is GIVEN.',
      );
    }

    return { quantity: null, isOverMedication: false };
  }
}
