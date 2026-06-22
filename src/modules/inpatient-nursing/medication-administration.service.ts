import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
  isSuperAdminStaff,
} from './inpatient-nursing.utils';
import {
  MedicationAdminStatus,
  PharmacyLocationType,
  Prisma,
} from '@prisma/client';
import {
  CreateMedicationAdministrationDto,
  UpdateMedicationAdministrationDto,
} from './dto/admission-medication.dto';
import {
  computeIsOverMedication,
  resolveOrderedQuantity,
  toAdministrationQuantity,
} from './medication-administration.utils';
import { DrugStockService } from '../pharmacy/drug-stock.service';
import { InvoiceService } from '../invoice/invoice.service';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

const medicationOrderSelect = {
  id: true,
  drugId: true,
  drugName: true,
  dose: true,
  quantity: true,
  route: true,
  frequency: true,
  encounterId: true,
  patientId: true,
} as const;

const invoiceItemSelect = {
  id: true,
  invoiceId: true,
  quantity: true,
  unitPrice: true,
  settled: true,
  dispensedAt: true,
  dispensaryLocationId: true,
  drug: { select: { id: true, genericName: true } },
  invoice: {
    select: {
      id: true,
      invoiceID: true,
      status: true,
      totalAmount: true,
      amountPaid: true,
    },
  },
  dispensaryLocation: {
    select: { id: true, name: true, locationType: true },
  },
} as const;

const marInclude = {
  medicationOrder: { select: medicationOrderSelect },
  nurse: { select: nurseSelect },
  pharmacyLocation: { select: { id: true, name: true, locationType: true } },
  invoiceItem: { select: invoiceItemSelect },
} as const;

type MarRow = Prisma.MedicationAdministrationGetPayload<{
  include: typeof marInclude;
}>;

@Injectable()
export class MedicationAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drugStockService: DrugStockService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    const rows = await this.prisma.medicationAdministration.findMany({
      where: { admissionId },
      orderBy: { scheduledTime: 'desc' },
      include: marInclude,
    });
    return rows.map((row) => this.mapMarResponse(row));
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
      where: { id: dto.medicationOrderId, admissionId },
    });
    if (!order) {
      throw new NotFoundException('Medication order not found');
    }

    const { quantity, isOverMedication } = this.buildAdministrationQuantityFields(
      order,
      dto.status,
      dto.quantity,
    );

    const shouldDeduct =
      !!dto.pharmacyLocationId &&
      dto.status === MedicationAdminStatus.GIVEN;

    let pharmacyLocationId: string | null = null;
    let stockDeductedQuantity: number | null = null;

    if (shouldDeduct) {
      const location = await this.prisma.pharmacyLocation.findUnique({
        where: { id: dto.pharmacyLocationId },
        select: { id: true, name: true, locationType: true },
      });
      if (!location || location.locationType !== PharmacyLocationType.DISPENSARY) {
        throw new BadRequestException('Invalid pharmacy location');
      }
      if (!order.drugId) {
        throw new BadRequestException(
          'Cannot deduct stock: medication order has no linked catalog drug.',
        );
      }

      stockDeductedQuantity = Math.ceil(Number(quantity));

      const available = await this.drugStockService.getAvailableQuantity(
        this.prisma,
        order.drugId,
        location.id,
      );
      if (available < stockDeductedQuantity) {
        throw new UnprocessableEntityException(
          `Insufficient stock at ${location.name}. Available: ${available}, required: ${stockDeductedQuantity}`,
        );
      }

      pharmacyLocationId = location.id;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      let invoiceItemId: string | null = null;

      if (shouldDeduct && order.drugId && stockDeductedQuantity && pharmacyLocationId) {
        const invoiceItem = await this.invoiceService.billSettledDrugDispenseLine(
          {
            encounterId: order.encounterId,
            patientId: order.patientId,
            drugId: order.drugId,
            quantity: stockDeductedQuantity,
            staffId,
            dispensaryLocationId: pharmacyLocationId,
          },
          tx,
        );
        invoiceItemId = invoiceItem.id;

        await this.drugStockService.deductDrugStockFifo(
          tx,
          order.drugId,
          stockDeductedQuantity,
          pharmacyLocationId,
        );
      }

      return tx.medicationAdministration.create({
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
          pharmacyLocationId,
          stockDeductedQuantity,
          invoiceItemId,
        },
        include: marInclude,
      });
    });

    return this.mapMarResponse(created);
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
            dto.quantity !== undefined
              ? dto.quantity
              : row.quantity != null
                ? Number(row.quantity)
                : undefined,
          )
        : null;

    const updated = await this.prisma.medicationAdministration.update({
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
      include: marInclude,
    });

    return this.mapMarResponse(updated);
  }

  private mapMarResponse(row: MarRow) {
    return {
      ...row,
      pharmacyLocation: row.pharmacyLocation
        ? { ...row.pharmacyLocation, isActive: true }
        : null,
      invoiceItem: row.invoiceItem
        ? {
            ...row.invoiceItem,
            dispensaryLocation: row.invoiceItem.dispensaryLocation
              ? { ...row.invoiceItem.dispensaryLocation, isActive: true }
              : null,
          }
        : null,
    };
  }

  private buildAdministrationQuantityFields(
    order: { quantity: Prisma.Decimal | null; dose: string | null },
    status: MedicationAdminStatus,
    quantityInput?: number,
  ): {
    quantity: ReturnType<typeof toAdministrationQuantity>;
    isOverMedication: boolean;
  } {
    if (status === MedicationAdminStatus.GIVEN) {
      if (quantityInput === undefined || quantityInput === null) {
        throw new BadRequestException(
          'Quantity is required when status is GIVEN',
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
