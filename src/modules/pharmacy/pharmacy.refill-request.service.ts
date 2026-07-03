import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrescriptionRefillRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PrescriptionRefillFulfillmentService } from '../patient-medications/prescription-refill-fulfillment.service';
import {
  buildActivePrescriptionWhere,
} from '../patient-medications/patient-medications.constants';
import { getHospitalDayEnd } from '../patient-medications/patient-medications.util';
import { parseDateRange } from '../../common/utils/date-range';
import { loadDrugWithLatestCost } from './drug-pricing-batch.util';
import {
  BillPharmacyRefillRequestDto,
  ListPharmacyRefillRequestsQueryDto,
  UpdatePharmacyRefillRequestDto,
} from './dto/pharmacy-refill-request.dto';
import { pharmacyRefillRequestInclude } from './pharmacy.refill-request.includes';
import {
  resolvePrimaryDrugItem,
  toBillPharmacyRefillResponse,
  toPharmacyRefillRequestDto,
} from './pharmacy.refill-request.util';

@Injectable()
export class PharmacyRefillRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly refillFulfillment: PrescriptionRefillFulfillmentService,
  ) {}

  async findAll(query: ListPharmacyRefillRequestsQueryDto) {
    const {
      skip = 0,
      take = 20,
      patientId,
      status = PrescriptionRefillRequestStatus.PENDING,
      fromDate,
      toDate,
    } = query;

    const where: Prisma.PrescriptionRefillRequestWhereInput = { status };

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

    if (fromDate && toDate) {
      const { from, to } = parseDateRange(fromDate, toDate);
      where.createdAt = { gte: from, lte: to };
    }

    const [rows, total] = await Promise.all([
      this.prisma.prescriptionRefillRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: pharmacyRefillRequestInclude,
      }),
      this.prisma.prescriptionRefillRequest.count({ where }),
    ]);

    return {
      data: rows.map(toPharmacyRefillRequestDto),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const row = await this.loadRefillOrThrow(id);
    return toPharmacyRefillRequestDto(row);
  }

  async updateStatus(id: string, dto: UpdatePharmacyRefillRequestDto) {
    await this.assertStaffExists(dto.reviewedByStaffId);

    const refill = await this.loadRefillOrThrow(id);

    if (dto.status === PrescriptionRefillRequestStatus.FULFILLED) {
      if (refill.status !== PrescriptionRefillRequestStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved refill requests can be marked fulfilled.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await this.refillFulfillment.fulfillRefill(id, tx);
      });
      return this.findOne(id);
    }

    if (refill.status !== PrescriptionRefillRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending refill requests can be approved or rejected.',
      );
    }

    if (
      dto.status !== PrescriptionRefillRequestStatus.APPROVED &&
      dto.status !== PrescriptionRefillRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Pending refill requests can only move to APPROVED or REJECTED.',
      );
    }

    if (
      dto.status === PrescriptionRefillRequestStatus.REJECTED &&
      !dto.pharmacyNotes?.trim()
    ) {
      throw new BadRequestException(
        'Pharmacy notes are required when rejecting a refill request.',
      );
    }

    const reviewedAt = new Date();
    await this.prisma.prescriptionRefillRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedByStaffId: dto.reviewedByStaffId,
        reviewedAt,
        pharmacyNotes: dto.pharmacyNotes?.trim() || null,
      },
    });

    return this.findOne(id);
  }

  async bill(id: string, dto: BillPharmacyRefillRequestDto) {
    const refill = await this.loadRefillOrThrow(id);

    if (refill.status !== PrescriptionRefillRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Refill must be approved before billing.',
      );
    }

    if (refill.invoiceItemId) {
      throw new ConflictException('This refill request is already billed.');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer.');
    }

    const now = new Date();
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: refill.prescriptionId,
        ...buildActivePrescriptionWhere(refill.patientId, getHospitalDayEnd(now)),
      },
      select: { id: true, refillsAllowed: true, endDate: true },
    });

    if (!prescription) {
      if (
        refill.prescription.endDate &&
        refill.prescription.endDate < now
      ) {
        throw new BadRequestException(
          'Prescription expired — patient needs a new consultation',
        );
      }
      throw new BadRequestException(
        'Prescription is not active and cannot be billed for refill.',
      );
    }

    if (prescription.refillsAllowed <= 0) {
      throw new BadRequestException(
        'No refills remaining on this prescription.',
      );
    }

    const drugItem = resolvePrimaryDrugItem(refill);
    if (!drugItem?.drugId) {
      throw new BadRequestException(
        'Prescription has no catalog drug to bill.',
      );
    }

    const [encounter, pharmacist] = await Promise.all([
      this.prisma.encounter.findUnique({
        where: { id: dto.encounterId },
        select: { id: true, patientId: true },
      }),
      this.prisma.staff.findUnique({
        where: { id: dto.billedByStaffId },
        select: { id: true },
      }),
    ]);

    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (!pharmacist) {
      throw new NotFoundException(
        `Staff "${dto.billedByStaffId}" not found.`,
      );
    }
    if (encounter.patientId !== refill.patientId) {
      throw new BadRequestException(
        'Encounter does not belong to the refill patient.',
      );
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

      const drug = await loadDrugWithLatestCost(tx, drugItem.drugId!);
      const invoiceItem = await this.invoiceService.addDrugItem(
        {
          invoiceId: invoice.id,
          drugId: drugItem.drugId!,
          quantity: dto.quantity,
          createdByStaffId: dto.billedByStaffId,
          preloadedDrug: drug,
        },
        tx,
      );

      const updatedRefill = await tx.prescriptionRefillRequest.update({
        where: { id },
        data: { invoiceItemId: invoiceItem.id },
        include: pharmacyRefillRequestInclude,
      });

      const refreshedInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        select: {
          id: true,
          invoiceID: true,
          status: true,
          totalAmount: true,
        },
      });

      return toBillPharmacyRefillResponse(
        updatedRefill,
        refreshedInvoice,
        {
          id: invoiceItem.id,
          drugId: invoiceItem.drugId,
          quantity: invoiceItem.quantity,
          unitPrice: invoiceItem.unitPrice,
          settled: invoiceItem.settled,
        },
      );
    });
  }

  private async loadRefillOrThrow(id: string) {
    const row = await this.prisma.prescriptionRefillRequest.findUnique({
      where: { id },
      include: pharmacyRefillRequestInclude,
    });
    if (!row) {
      throw new NotFoundException(`Refill request "${id}" not found.`);
    }
    return row;
  }

  private async assertStaffExists(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${staffId}" not found.`);
    }
  }
}
