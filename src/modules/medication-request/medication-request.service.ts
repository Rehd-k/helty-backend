import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  MedicationRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  BillMedicationRequestsDto,
  CreateMedicationRequestDto,
  ListMedicationRequestsQueryDto,
  UpdateMedicationRequestDto,
} from './dto/create-medication-request.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { getPatientAdmissionContext } from '../../common/utils/patient-admission-context.util';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { medicationRequestWithDetailsInclude } from './medication-request-includes';
import { isOutpatientPatient } from '../../common/utils/patient-outpatient.util';
import { loadDrugWithLatestCost } from '../pharmacy/drug-pricing-batch.util';
import { ClinicalPackageService } from '../clinical-package/clinical-package.service';

const REQUESTABLE_ORDER_STATUSES = [
  'Prescribed',
  'Pending Dispense',
  'Dispensed',
] as const;

type RequestForMutation = Prisma.MedicationRequestGetPayload<{
  include: {
    medicationOrder: { select: { id: true; doctorId: true } };
    invoiceItem: {
      include: {
        invoice: { select: { id: true; status: true } };
        _count: { select: { allocations: true } };
      };
    };
  };
}>;

@Injectable()
export class MedicationRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly clinicalPackageService: ClinicalPackageService,
  ) {}

  private asDecimal(value: number | string | Prisma.Decimal) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private async loadRequestForMutation(id: string, tx: Prisma.TransactionClient) {
    const request = await tx.medicationRequest.findUnique({
      where: { id },
      include: {
        medicationOrder: {
          select: { id: true, doctorId: true, status: true },
        },
        invoiceItem: {
          include: {
            invoice: { select: { id: true, status: true } },
            _count: { select: { allocations: true } },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException(`Medication request "${id}" not found.`);
    }
    return request;
  }

  private isBilledUnpaidUnsettled(request: RequestForMutation): boolean {
    const item = request.invoiceItem;
    if (!item || request.status !== MedicationRequestStatus.BILLED) {
      return false;
    }
    if (item.settled) return false;
    if (this.asDecimal(item.amountPaid).gt(0)) return false;
    if (item._count.allocations > 0) return false;
    if (item.invoice.status === InvoiceStatus.PAID) return false;
    return true;
  }

  private assertRequestMutable(request: RequestForMutation): void {
    if (request.status === MedicationRequestStatus.REQUESTED) {
      return;
    }
    if (this.isBilledUnpaidUnsettled(request)) {
      return;
    }
    if (request.status === MedicationRequestStatus.BILLED) {
      throw new BadRequestException(
        'This medication request is billed and cannot be changed while the invoice line is paid or settled.',
      );
    }
    throw new BadRequestException(
      'Only REQUESTED or unpaid unsettled BILLED medication requests can be modified.',
    );
  }

  private assertActorCanUpdate(
    request: RequestForMutation,
    actorStaffId: string,
  ): void {
    this.assertRequestMutable(request);
    const isPrescriber =
      actorStaffId === request.medicationOrder.doctorId;

    if (request.status === MedicationRequestStatus.REQUESTED) {
      const isRequestCreator = actorStaffId === request.requestedByNurseId;
      if (isPrescriber || !isRequestCreator) {
        return;
      }
      throw new ForbiddenException(
        'Nurses cannot update medication requests; contact pharmacy or the prescribing doctor.',
      );
    }

    if (!isPrescriber) {
      throw new ForbiddenException(
        'Only the prescribing doctor can update a billed medication request.',
      );
    }
  }

  private assertActorCanCancel(
    request: RequestForMutation,
    actorStaffId: string,
  ): void {
    this.assertRequestMutable(request);
    const isPrescriber =
      actorStaffId === request.medicationOrder.doctorId;
    const isRequestCreator = actorStaffId === request.requestedByNurseId;

    if (request.status === MedicationRequestStatus.REQUESTED) {
      if (isPrescriber || isRequestCreator) {
        return;
      }
      throw new ForbiddenException(
        'Only the prescribing doctor, the requesting nurse, or pharmacy staff may cancel this request.',
      );
    }

    if (!isPrescriber) {
      throw new ForbiddenException(
        'Only the prescribing doctor can cancel a billed medication request.',
      );
    }
  }

  /** Pharmacy may cancel REQUESTED requests (not the prescriber or request creator). */
  private isPharmacyCancelOnRequested(
    request: RequestForMutation,
    actorStaffId: string,
  ): boolean {
    return (
      request.status === MedicationRequestStatus.REQUESTED &&
      actorStaffId !== request.medicationOrder.doctorId &&
      actorStaffId !== request.requestedByNurseId
    );
  }

  private assertActorCanCancelWithPharmacy(
    request: RequestForMutation,
    actorStaffId: string,
  ): void {
    try {
      this.assertActorCanCancel(request, actorStaffId);
    } catch (error) {
      if (
        error instanceof ForbiddenException &&
        request.status === MedicationRequestStatus.REQUESTED &&
        this.isPharmacyCancelOnRequested(request, actorStaffId)
      ) {
        return;
      }
      throw error;
    }
  }

  private async revertOrderStatusIfNoBilledRequests(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const remainingBilled = await tx.medicationRequest.count({
      where: {
        medicationOrderId: orderId,
        status: MedicationRequestStatus.BILLED,
      },
    });
    if (remainingBilled === 0) {
      const order = await tx.medicationOrder.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (order?.status === 'Pending Dispense') {
        await tx.medicationOrder.update({
          where: { id: orderId },
          data: { status: 'Prescribed' },
        });
      }
    }
  }

  async create(dto: CreateMedicationRequestDto) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id: dto.medicationOrderId },
      include: {
        encounter: { select: { id: true, patientId: true, status: true } },
      },
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order "${dto.medicationOrderId}" not found.`,
      );
    }
    if (!order.drugId) {
      throw new BadRequestException(
        'Cannot request medication for an order without a catalog drug.',
      );
    }
    if (
      !REQUESTABLE_ORDER_STATUSES.includes(
        order.status as (typeof REQUESTABLE_ORDER_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        `Cannot request medication for an order with status "${order.status}".`,
      );
    }

    if (await isOutpatientPatient(this.prisma, order.patientId)) {
      throw new BadRequestException(
        'Outpatient medication requests are created when the doctor prescribes. Nurses cannot submit requests for outpatients.',
      );
    }

    const nurse = await this.prisma.staff.findUnique({
      where: { id: dto.requestedByNurseId },
    });
    if (!nurse) {
      throw new NotFoundException(
        `Staff "${dto.requestedByNurseId}" not found.`,
      );
    }

    const admissionCtx = await getPatientAdmissionContext(
      this.prisma,
      order.patientId,
    );

    return this.prisma.medicationRequest.create({
      data: {
        medicationOrderId: order.id,
        encounterId: order.encounterId,
        patientId: order.patientId,
        requestedQuantity: dto.requestedQuantity,
        requestedByNurseId: dto.requestedByNurseId,
        notes: dto.notes ?? undefined,
        admissionId: admissionCtx.admissionId,
        wardId: admissionCtx.wardId,
      },
      include: medicationRequestWithDetailsInclude,
    });
  }

  async findAll(query: ListMedicationRequestsQueryDto) {
    const {
      skip = 0,
      take = 20,
      encounterId,
      patientId,
      status,
      fromDate,
      toDate,
    } = query;

    const where: Prisma.MedicationRequestWhereInput = {};
    if (encounterId) where.encounterId = encounterId;
    if (patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { patientId: patientId.trim().toUpperCase() },
        select: { id: true },
      });
      if (!patient) {
        return { data: [], total: 0, skip, take };
      }
      where.patientId = patient.id;
    }
    if (status) where.status = status;
    if (fromDate && toDate) {
      const { from, to } = parseDateRange(fromDate, toDate);
      where.createdAt = { gte: from, lte: to };
    }

    const [data, total] = await Promise.all([
      this.prisma.medicationRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: medicationRequestWithDetailsInclude,
      }),
      this.prisma.medicationRequest.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.medicationRequest.findUnique({
      where: { id },
      include: medicationRequestWithDetailsInclude,
    });
    if (!request) {
      throw new NotFoundException(`Medication request "${id}" not found.`);
    }
    return request;
  }

  async findByEncounterId(encounterId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${encounterId}" not found.`);
    }

    return this.prisma.medicationRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: medicationRequestWithDetailsInclude,
    });
  }

  async update(id: string, dto: UpdateMedicationRequestDto) {
    const alternativeDrugId = dto.drugId ?? dto.alternativeDrugId;

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.modifiedByStaffId },
    });
    if (!staff) {
      throw new NotFoundException(
        `Staff "${dto.modifiedByStaffId}" not found.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.loadRequestForMutation(id, tx);
      this.assertActorCanUpdate(existing, dto.modifiedByStaffId);

      const requestUpdateData: Prisma.MedicationRequestUpdateInput = {};
      if (dto.requestedQuantity !== undefined) {
        requestUpdateData.requestedQuantity = dto.requestedQuantity;
      }
      if (dto.notes !== undefined) {
        requestUpdateData.notes = dto.notes;
      }

      if (alternativeDrugId === undefined) {
        if (
          existing.status === MedicationRequestStatus.BILLED &&
          existing.invoiceItemId &&
          dto.requestedQuantity !== undefined
        ) {
          await this.invoiceService.syncDrugInvoiceLine(
            existing.invoiceItemId,
            { billingQuantity: dto.requestedQuantity },
            tx,
          );
        }

        return tx.medicationRequest.update({
          where: { id },
          data: requestUpdateData,
          include: medicationRequestWithDetailsInclude,
        });
      }

      const order = await tx.medicationOrder.findUnique({
        where: { id: existing.medicationOrderId },
      });
      if (!order) {
        throw new NotFoundException('Medication order not found');
      }

      const drug = await tx.drug.findFirst({
        where: { id: alternativeDrugId, deletedAt: null },
      });
      if (!drug) {
        throw new BadRequestException(
          'Cannot substitute to a drug without catalog id',
        );
      }

      const isPrescriber =
        dto.modifiedByStaffId === existing.medicationOrder.doctorId;
      const orderUpdateData: Prisma.MedicationOrderUpdateInput = {
        drug: { connect: { id: drug.id } },
        drugName: drug.genericName,
      };
      if (!isPrescriber) {
        orderUpdateData.substitutedByPharmacist = {
          connect: { id: dto.modifiedByStaffId },
        };
        orderUpdateData.substitutedAt = new Date();
      }

      await tx.medicationOrder.update({
        where: { id: order.id },
        data: orderUpdateData,
      });

      if (
        existing.status === MedicationRequestStatus.BILLED &&
        existing.invoiceItemId
      ) {
        await this.invoiceService.syncDrugInvoiceLine(
          existing.invoiceItemId,
          {
            drugId: drug.id,
            billingQuantity: dto.requestedQuantity ?? existing.requestedQuantity,
          },
          tx,
        );
      }

      return tx.medicationRequest.update({
        where: { id },
        data: requestUpdateData,
        include: medicationRequestWithDetailsInclude,
      });
    });
  }

  async remove(id: string, cancelledByStaffId: string) {
    if (!cancelledByStaffId) {
      throw new BadRequestException('cancelledByStaffId is required.');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: cancelledByStaffId },
    });
    if (!staff) {
      throw new NotFoundException(
        `Staff "${cancelledByStaffId}" not found.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.loadRequestForMutation(id, tx);
      this.assertActorCanCancelWithPharmacy(existing, cancelledByStaffId);

      if (
        existing.status === MedicationRequestStatus.BILLED &&
        existing.invoiceItemId
      ) {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          existing.invoiceItemId,
          tx,
        );
      }

      await tx.medicationRequest.update({
        where: { id },
        data: {
          status: MedicationRequestStatus.CANCELLED,
          invoiceItemId: null,
        },
      });

      await this.revertOrderStatusIfNoBilledRequests(
        existing.medicationOrderId,
        tx,
      );

      return { message: 'Medication request cancelled successfully.' };
    });
  }

  async bill(dto: BillMedicationRequestsDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }

    const pharmacist = await this.prisma.staff.findUnique({
      where: { id: dto.billedByStaffId },
    });
    if (!pharmacist) {
      throw new NotFoundException(
        `Staff "${dto.billedByStaffId}" not found.`,
      );
    }

    const where: Prisma.MedicationRequestWhereInput = {
      encounterId: dto.encounterId,
      status: MedicationRequestStatus.REQUESTED,
      invoiceItemId: null,
    };
    if (dto.requestIds?.length) {
      where.id = { in: dto.requestIds };
    }

    const requests = await this.prisma.medicationRequest.findMany({
      where,
      include: {
        medicationOrder: {
          select: {
            id: true,
            drugId: true,
            patientId: true,
            status: true,
            doctorId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (requests.length === 0) {
      throw new BadRequestException(
        'No billable medication requests found for this encounter.',
      );
    }

    if (dto.requestIds?.length && requests.length !== dto.requestIds.length) {
      throw new BadRequestException(
        'One or more request IDs are invalid, already billed, or not in REQUESTED status.',
      );
    }

    for (const request of requests) {
      if (!request.medicationOrder.drugId) {
        throw new BadRequestException(
          `Medication order "${request.medicationOrderId}" has no catalog drug.`,
        );
      }
      if (request.medicationOrder.patientId !== encounter.patientId) {
        throw new BadRequestException(
          'Medication request patient does not match the encounter patient.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceService.ensureInvoiceForEncounter(
        {
          encounterId: dto.encounterId,
          patientId: encounter.patientId,
          staffId: dto.billedByStaffId,
        },
        tx,
      );

      const billedRequests: Awaited<
        ReturnType<typeof tx.medicationRequest.update>
      >[] = [];
      const orderIdsToUpdate = new Set<string>();

      for (const request of requests) {
        const drugId = request.medicationOrder.drugId!;
        const drug = await loadDrugWithLatestCost(tx, drugId);

        const packageItem =
          await this.clinicalPackageService.resolveAntenatalPackageItemForDrug(
            encounter.patientId,
            drugId,
          );

        let invoiceItem;
        if (packageItem) {
          const billed = await this.invoiceService.createAntenatalPackageDrugItem(
            {
              patientId: encounter.patientId,
              encounterId: dto.encounterId,
              staffId: dto.billedByStaffId,
              drugId,
              clinicalPackageItemId: packageItem.packageItemId,
              quantity: request.requestedQuantity,
            },
          );
          invoiceItem = await tx.invoiceItem.findUniqueOrThrow({
            where: { id: billed.invoiceItemId },
            include: {
              drug: { select: { id: true, genericName: true } },
              invoice: { select: { id: true, status: true, patientId: true } },
            },
          });
        } else {
          invoiceItem = await this.invoiceService.addDrugItem(
            {
              invoiceId: invoice.id,
              drugId,
              quantity: request.requestedQuantity,
              createdByStaffId: dto.billedByStaffId,
              preloadedDrug: drug,
            },
            tx,
          );
        }

        const billed = await tx.medicationRequest.update({
          where: { id: request.id },
          data: {
            status: MedicationRequestStatus.BILLED,
            invoiceItemId: invoiceItem.id,
            billedById: dto.billedByStaffId,
            billedAt: new Date(),
          },
          include: medicationRequestWithDetailsInclude,
        });
        billedRequests.push(billed);
        orderIdsToUpdate.add(request.medicationOrderId);
      }

      for (const orderId of orderIdsToUpdate) {
        const order = await tx.medicationOrder.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (
          order &&
          order.status !== 'Dispensed' &&
          order.status !== 'Cancelled'
        ) {
          await tx.medicationOrder.update({
            where: { id: orderId },
            data: { status: 'Pending Dispense' },
          });
        }
      }

      const refreshedInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          invoiceItems: {
            include: {
              drug: { select: { id: true, genericName: true } },
            },
          },
          patient: {
            select: patientNameFieldsSelect,
          },
        },
      });

      return { invoice: refreshedInvoice, billedRequests };
    });
  }
}
