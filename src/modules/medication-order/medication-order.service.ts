import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EncounterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';

const drugWithPricingBatchInclude = {
  batches: {
    where: { quantityRemaining: { gt: 0 } },
    orderBy: { expiryDate: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.DrugInclude;

type DrugWithPricingBatch = Prisma.DrugGetPayload<{
  include: typeof drugWithPricingBatchInclude;
}>;

@Injectable()
export class MedicationOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateMedicationOrderDto) {
    const [, drug, patient, doctor] = await Promise.all([
      this.loadEncounterForPatient(dto.encounterId, dto.patientId),
      this.loadDrugWithPricingBatch(dto.drugId),
      this.validatePatient(dto.patientId),
      this.validateDoctor(dto.doctorId),
    ]);
    if (dto.admissionId) {
      await this.validateAdmission(
        dto.admissionId,
        dto.encounterId,
        dto.patientId,
      );
    }

    const { billingQuantity, clinicalQuantity } =
      this.resolveCreateQuantities(dto);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceService.ensureInvoiceForEncounter(
        {
          encounterId: dto.encounterId,
          patientId: dto.patientId,
          staffId: dto.doctorId,
        },
        tx,
      );
      const invoiceItem = await this.invoiceService.addDrugItem(
        {
          invoiceId: invoice.id,
          drugId: dto.drugId,
          quantity: billingQuantity,
          createdByStaffId: dto.doctorId,
          preloadedDrug: drug,
        },
        tx,
      );
      return tx.medicationOrder.create({
        data: {
          encounterId: dto.encounterId,
          admissionId: dto.admissionId,
          drugId: dto.drugId,
          drugName: drug.genericName,
          dose: dto.dose ?? undefined,
          quantity: clinicalQuantity,
          frequency: dto.frequency ?? undefined,
          duration: dto.duration ?? undefined,
          route: dto.route ?? undefined,
          specialInstructions: dto.specialInstructions ?? undefined,
          startDateTime: dto.startDateTime
            ? new Date(dto.startDateTime)
            : undefined,
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : undefined,
          notes: dto.notes ?? undefined,
          administrationStatus: dto.administrationStatus ?? undefined,
          patientId: patient.id,
          doctorId: doctor.id,
          invoiceItemId: invoiceItem.id,
        },
        include: this.defaultInclude(),
      });
    });
  }

  async findAll(
    skip = 0,
    take = 20,
    encounterId?: string,
    patientId?: string,
    status?: string,
  ) {
    const where: {
      encounterId?: string;
      patientId?: string;
      status?: string;
    } = {};
    if (encounterId) where.encounterId = encounterId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.medicationOrder.findMany({
        where,
        skip,
        take,
        orderBy: this.defaultOrderBy(),
        include: this.defaultInclude(),
      }),
      this.prisma.medicationOrder.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order with id "${id}" not found.`,
      );
    }
    return order;
  }

  async findByEncounterId(encounterId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter with id "${encounterId}" not found.`,
      );
    }

    return this.prisma.medicationOrder.findMany({
      where: { encounterId },
      orderBy: this.defaultOrderBy(),
      include: this.defaultInclude(),
    });
  }

  async update(id: string, dto: UpdateMedicationOrderDto) {
    const existing = await this.prisma.medicationOrder.findUnique({
      where: { id },
      include: {
        ...this.defaultInclude(),
        invoiceItem: {
          select: {
            id: true,
            settled: true,
            quantity: true,
            drugId: true,
            invoice: { select: { id: true, status: true } },
          },
        },
        _count: { select: { administrations: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Medication order with id "${id}" not found.`,
      );
    }

    if (
      dto.drugId !== undefined &&
      dto.drugId !== existing.drugId &&
      existing.status === 'Dispensed'
    ) {
      throw new BadRequestException(
        'Cannot change the drug on a dispensed medication order.',
      );
    }

    let drugName: string | undefined;
    if (dto.drugId !== undefined && dto.drugId !== existing.drugId) {
      const drug = await this.validateDrug(dto.drugId);
      drugName = drug.genericName;
    }

    const billingQuantityChange =
      dto.billingQuantity !== undefined &&
      existing.invoiceItem &&
      dto.billingQuantity !== existing.invoiceItem.quantity;
    const drugIdChange =
      dto.drugId !== undefined &&
      existing.invoiceItem &&
      dto.drugId !== existing.invoiceItem.drugId;

    return this.prisma.$transaction(async (tx) => {
      if (dto.status === 'Cancelled' && existing.invoiceItemId) {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          existing.invoiceItemId,
          tx,
        );
      } else if (existing.invoiceItemId && (billingQuantityChange || drugIdChange)) {
        await this.invoiceService.syncDrugInvoiceLine(
          existing.invoiceItemId,
          {
            ...(drugIdChange && dto.drugId !== undefined
              ? { drugId: dto.drugId }
              : {}),
            ...(billingQuantityChange && dto.billingQuantity !== undefined
              ? { billingQuantity: dto.billingQuantity }
              : {}),
          },
          tx,
        );
      }

      return tx.medicationOrder.update({
        where: { id },
        data: {
          ...(dto.drugId !== undefined &&
            drugName !== undefined && {
              drugId: dto.drugId,
              drugName,
            }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.dose !== undefined && { dose: dto.dose }),
          ...(dto.quantity !== undefined && {
            quantity: new Prisma.Decimal(dto.quantity),
          }),
          ...(dto.frequency !== undefined && { frequency: dto.frequency }),
          ...(dto.duration !== undefined && { duration: dto.duration }),
          ...(dto.route !== undefined && { route: dto.route }),
          ...(dto.specialInstructions !== undefined && {
            specialInstructions: dto.specialInstructions,
          }),
          ...(dto.administrationStatus !== undefined && {
            administrationStatus: dto.administrationStatus,
          }),
          ...(dto.endDateTime !== undefined && {
            endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: this.defaultInclude(),
      });
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.medicationOrder.findUnique({
      where: { id },
      include: {
        _count: { select: { administrations: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Medication order with id "${id}" not found.`,
      );
    }
    if (existing._count.administrations > 0) {
      throw new BadRequestException(
        'Cannot delete an order that already has administration records.',
      );
    }
    if (existing.status === 'Dispensed') {
      throw new BadRequestException(
        'Cannot delete a dispensed medication order.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing.invoiceItemId) {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          existing.invoiceItemId,
          tx,
        );
      }
      await tx.medicationOrder.delete({ where: { id } });
    });
  }

  private resolveCreateQuantities(dto: CreateMedicationOrderDto): {
    billingQuantity: number;
    clinicalQuantity: Prisma.Decimal | undefined;
  } {
    const hasExplicitBilling = dto.billingQuantity != null;
    const billingQuantity = hasExplicitBilling
      ? dto.billingQuantity!
      : dto.quantity != null
        ? Math.round(dto.quantity)
        : 1;
    const clinicalQuantity =
      hasExplicitBilling && dto.quantity != null
        ? new Prisma.Decimal(dto.quantity)
        : undefined;
    return { billingQuantity, clinicalQuantity };
  }

  private async loadEncounterForPatient(
    encounterId: string,
    patientId: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter with id "${encounterId}" not found.`,
      );
    }
    if (encounter.patientId !== patientId) {
      throw new BadRequestException(
        'Encounter does not belong to the given patient.',
      );
    }
    if (encounter.status === EncounterStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot create a medication order for a cancelled encounter.',
      );
    }
    return encounter;
  }

  private async loadDrugWithPricingBatch(
    drugId: string,
  ): Promise<DrugWithPricingBatch> {
    const drug = await this.prisma.drug.findUnique({
      where: { id: drugId },
      include: drugWithPricingBatchInclude,
    });
    if (!drug) {
      throw new NotFoundException(`Drug with id "${drugId}" not found.`);
    }
    return drug;
  }

  private async validateDrug(drugId: string) {
    const drug = await this.prisma.drug.findUnique({
      where: { id: drugId },
    });
    if (!drug) {
      throw new NotFoundException(`Drug with id "${drugId}" not found.`);
    }
    return drug;
  }

  private async validateAdmission(
    admissionId: string,
    encounterId: string,
    patientId: string,
  ) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: admissionId },
      select: {
        id: true,
        patientId: true,
        encounter: { select: { id: true } },
      },
    });
    if (!admission) {
      throw new NotFoundException(
        `Admission with id "${admissionId}" not found.`,
      );
    }
    if (admission.patientId !== patientId) {
      throw new BadRequestException(
        'Admission does not belong to the given patient.',
      );
    }
    if (admission.encounter?.id !== encounterId) {
      throw new BadRequestException(
        'Admission does not belong to the given encounter.',
      );
    }
  }

  private async validatePatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with id "${patientId}" not found.`);
    }
    return patient;
  }

  private async validateDoctor(doctorId: string) {
    const doctor = await this.prisma.staff.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with id "${doctorId}" not found.`);
    }
    return doctor;
  }

  private defaultOrderBy(): Prisma.MedicationOrderOrderByWithRelationInput[] {
    return [
      { startDateTime: { sort: 'desc', nulls: 'last' } },
      { createdAt: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ];
  }

  private defaultInclude() {
    return {
      encounter: {
        select: {
          id: true,
          encounterType: true,
          status: true,
          patientId: true,
        },
      },
      admission: {
        select: {
          id: true,
          status: true,
          admissionDate: true,
        },
      },
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      drug: {
        select: {
          id: true,
          genericName: true,
        },
      },
      invoiceItem: {
        select: { id: true },
      },
    };
  }
}
