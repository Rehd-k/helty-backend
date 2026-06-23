import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EncounterStatus, MedicationAdministrationLifecycleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { MedicationScheduleService } from '../medication-schedule/medication-schedule.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';
import { BeyondDurationConsentDto } from './dto/beyond-duration-consent.dto';
import { isOutpatientPatient } from '../../common/utils/patient-outpatient.util';
import { resolveOrderingDoctorId } from '../encounter/encounter-inpatient-edit.util';

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
    private readonly medicationScheduleService: MedicationScheduleService,
  ) {}

  async create(dto: CreateMedicationOrderDto, actingStaffId: string) {
    const encounter = await this.loadEncounterForPatient(
      dto.encounterId,
      dto.patientId,
    );
    const doctorId = resolveOrderingDoctorId(
      encounter,
      actingStaffId,
      dto.doctorId,
    );
    const [, drug, patient, doctor] = await Promise.all([
      Promise.resolve(encounter),
      this.loadDrugWithPricingBatch(dto.drugId),
      this.validatePatient(dto.patientId),
      this.validateDoctor(doctorId),
    ]);
    if (dto.admissionId) {
      await this.validateAdmission(
        dto.admissionId,
        dto.encounterId,
        dto.patientId,
      );
    }

    const isOutpatient = await isOutpatientPatient(this.prisma, dto.patientId);

    if (isOutpatient) {
      if (dto.admissionId) {
        throw new BadRequestException(
          'Outpatient medication orders cannot include admissionId.',
        );
      }
      if (dto.requestedQuantity == null) {
        throw new BadRequestException(
          'requestedQuantity is required for outpatient prescriptions.',
        );
      }
    } else if (dto.requestedQuantity != null) {
      throw new BadRequestException(
        'requestedQuantity is only for outpatient prescriptions. Nurses enter billing quantity via medication requests for inpatients.',
      );
    }

    const clinicalQuantity =
      dto.quantity != null ? new Prisma.Decimal(dto.quantity) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.medicationOrder.create({
        data: {
          encounterId: dto.encounterId,
          admissionId: dto.admissionId,
          drugId: dto.drugId,
          drugName: drug.genericName,
          prescribedDrugId: dto.drugId,
          prescribedDrugName: drug.genericName,
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
          status: 'Prescribed',
        },
      });

      if (isOutpatient) {
        await tx.medicationRequest.create({
          data: {
            medicationOrderId: order.id,
            encounterId: order.encounterId,
            patientId: order.patientId,
            requestedQuantity: dto.requestedQuantity!,
            requestedByNurseId: doctor.id,
            notes: dto.notes ?? undefined,
          },
        });
      }

      if (dto.admissionId) {
        await this.medicationScheduleService.ensureScheduleForOrder(
          order.id,
          tx,
          { frequency: dto.frequency, duration: dto.duration },
        );
      }

      const created = await tx.medicationOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: this.defaultSelect(),
      });
      return this.mapOrderResponse(created);
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
        select: this.defaultSelect(),
      }),
      this.prisma.medicationOrder.count({ where }),
    ]);

    return {
      data: data.map((row) => this.mapOrderResponse(row)),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order with id "${id}" not found.`,
      );
    }
    return this.mapOrderResponse(order);
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

    const rows = await this.prisma.medicationOrder.findMany({
      where: { encounterId },
      orderBy: this.defaultOrderBy(),
      select: this.defaultSelect(),
    });
    return rows.map((row) => this.mapOrderResponse(row));
  }

  async update(id: string, dto: UpdateMedicationOrderDto) {
    const existing = await this.prisma.medicationOrder.findUnique({
      where: { id },
      select: {
        ...this.defaultSelect(),
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

    const result = await this.prisma.$transaction(async (tx) => {
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

      const updated = await tx.medicationOrder.update({
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
        select: this.defaultSelect(),
      });

      if (dto.duration !== undefined && existing.admissionId) {
        await this.medicationScheduleService.updateScheduleFromDurationChange(
          id,
          dto.duration ?? null,
          tx,
        );
      }

      if (
        dto.administrationStatus ===
          MedicationAdministrationLifecycleStatus.STOPPED &&
        existing.admissionId
      ) {
        await this.medicationScheduleService.stopSchedule(id, tx);
      }

      return updated;
    });

    return this.mapOrderResponse(result);
  }

  async getDoseSchedule(orderId: string) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id: orderId },
      select: { id: true, admissionId: true, doseSchedule: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order with id "${orderId}" not found.`,
      );
    }
    if (!order.doseSchedule) {
      if (order.admissionId) {
        const schedule =
          await this.medicationScheduleService.ensureScheduleForOrder(orderId);
        return this.medicationScheduleService.mapScheduleToApi(schedule);
      }
      throw new NotFoundException('Dose schedule not found for this order.');
    }
    return this.medicationScheduleService.mapScheduleToApi(order.doseSchedule);
  }

  async recordBeyondDurationConsent(
    orderId: string,
    doctorId: string,
    dto: BeyondDurationConsentDto,
  ) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order with id "${orderId}" not found.`,
      );
    }

    if (!dto.consentNote?.trim() && dto.extendDurationValue == null) {
      throw new BadRequestException(
        'Provide consentNote and/or extendDurationValue with extendDurationUnit.',
      );
    }

    await this.medicationScheduleService.recordBeyondDurationConsent({
      orderId,
      doctorId,
      consentNote: dto.consentNote,
      extendDurationValue: dto.extendDurationValue,
      extendDurationUnit: dto.extendDurationUnit,
    });

    return this.findOne(orderId);
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
    const billedOrDispensedRequests =
      await this.prisma.medicationRequest.count({
        where: {
          medicationOrderId: id,
          status: { in: ['BILLED', 'DISPENSED'] },
        },
      });
    if (existing._count.administrations > 0) {
      throw new BadRequestException(
        'Cannot delete an order that already has administration records.',
      );
    }
    if (billedOrDispensedRequests > 0) {
      throw new BadRequestException(
        'Cannot delete an order that has billed or dispensed medication requests.',
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

  private async loadEncounterForPatient(
    encounterId: string,
    patientId: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        patientId: true,
        status: true,
        admissionId: true,
        admission: { select: { status: true } },
      },
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

  private defaultSelect(): Prisma.MedicationOrderSelect {
    return {
      id: true,
      encounterId: true,
      admissionId: true,
      drugId: true,
      drugName: true,
      prescribedDrugId: true,
      prescribedDrugName: true,
      substitutedAt: true,
      dose: true,
      quantity: true,
      frequency: true,
      duration: true,
      route: true,
      specialInstructions: true,
      startDateTime: true,
      endDateTime: true,
      notes: true,
      administrationStatus: true,
      patientId: true,
      doctorId: true,
      status: true,
      invoiceItemId: true,
      createdAt: true,
      updatedAt: true,
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
          staffId: true,
        },
      },
      prescribedDrug: {
        select: { id: true, genericName: true, brandName: true },
      },
      substitutedByPharmacist: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
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
      medicationRequests: {
        select: {
          id: true,
          requestedQuantity: true,
          status: true,
          createdAt: true,
          requestedByNurse: {
            select: { id: true, firstName: true, lastName: true },
          },
          invoiceItem: { select: { id: true, settled: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      doseSchedule: true,
    };
  }

  private mapOrderResponse<T extends { doseSchedule?: unknown }>(order: T) {
    const { doseSchedule, ...rest } = order as T & {
      doseSchedule?: Parameters<
        MedicationScheduleService['mapScheduleToApi']
      >[0] | null;
    };
    return {
      ...rest,
      doseSchedule: doseSchedule
        ? this.medicationScheduleService.mapScheduleToApi(
            doseSchedule as Parameters<
              MedicationScheduleService['mapScheduleToApi']
            >[0],
          )
        : null,
    };
  }
}
