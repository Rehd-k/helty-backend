import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LabRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateLabRequestDto,
  UpdateLabRequestDto,
  ListLabRequestsQueryDto,
} from './dto/create-lab-request.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { labRequestWithBillingInclude } from './lab-request-includes';
import { resolveOrderingDoctorId } from '../encounter/encounter-inpatient-edit.util';
import { PregnancyClinicalContextService } from '../obstetrics/pregnancy-clinical-context.service';
import { ClinicalPackageService } from '../clinical-package/clinical-package.service';

@Injectable()
export class LabRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly pregnancyClinicalContext: PregnancyClinicalContextService,
    private readonly clinicalPackageService: ClinicalPackageService,
  ) {}

  async create(dto: CreateLabRequestDto, actingStaffId: string) {
    if (!dto.encounterId && !dto.pregnancyId) {
      throw new BadRequestException(
        'Either encounterId or pregnancyId is required.',
      );
    }
    let encounterId = dto.encounterId;
    let pregnancyId = dto.pregnancyId;
    if (dto.pregnancyId) {
      const ctx = await this.pregnancyClinicalContext.resolve(dto.pregnancyId, {
        patientId: dto.patientId,
      });
      encounterId = encounterId ?? ctx.encounterId;
      pregnancyId = ctx.pregnancyId;
    }
    if (!encounterId) {
      throw new BadRequestException('encounterId could not be resolved.');
    }

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
      select: {
        id: true,
        patientId: true,
        admissionId: true,
        admission: { select: { status: true } },
      },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException('Patient does not match the encounter.');
    }
    const requestedByDoctorId = resolveOrderingDoctorId(
      encounter,
      actingStaffId,
      dto.requestedByDoctorId,
    );
    const labRequest = await this.prisma.labRequest.create({
      data: {
        encounterId,
        patientId: dto.patientId,
        requestedByDoctorId,
        testType: dto.testType,
        notes: dto.notes,
        pregnancyId: pregnancyId ?? null,
      },
    });
    if (dto.serviceId) {
      await this.invoiceService.assertServiceCategoryForEncounterBilling(
        dto.serviceId,
        'lab',
      );
      const packageItem =
        dto.useAntenatalPackage !== false
          ? await this.clinicalPackageService.resolveAntenatalPackageItemForService(
              dto.patientId,
              dto.serviceId,
            )
          : null;
      const billing =
        packageItem != null
          ? await this.invoiceService.createAntenatalPackageServiceItem({
              patientId: dto.patientId,
              encounterId,
              staffId: requestedByDoctorId,
              serviceId: dto.serviceId,
              clinicalPackageItemId: packageItem.packageItemId,
            })
          : await this.invoiceService.createWithServiceItem({
              patientId: dto.patientId,
              encounterId,
              staffId: requestedByDoctorId,
              serviceId: dto.serviceId,
            });
      const { invoice, invoiceItemId } = billing;
      return this.prisma.labRequest.update({
        where: { id: labRequest.id },
        data: { invoiceId: invoice.id, invoiceItemId },
        include: labRequestWithBillingInclude,
      });
    }
    return this.prisma.labRequest.findUniqueOrThrow({
      where: { id: labRequest.id },
      include: labRequestWithBillingInclude,
    });
  }

  async findAll(query: ListLabRequestsQueryDto) {
    const {
      skip = 0,
      take = 20,
      encounterId,
      patientId,
      fromDate,
      toDate,
    } = query;
    const { from, to } = parseDateRange(fromDate, toDate);

    const where: {
      encounterId?: string;
      patientId?: string;
      createdAt?: { gte: Date; lte: Date };
    } = {};
    if (encounterId) where.encounterId = encounterId;
    if (patientId) where.patientId = patientId;
    if (fromDate && toDate) where.createdAt = { gte: from, lte: to };

    const [data, total] = await Promise.all([
      this.prisma.labRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: labRequestWithBillingInclude,
      }),
      this.prisma.labRequest.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.labRequest.findUnique({
      where: { id },
      include: labRequestWithBillingInclude,
    });
    if (!request) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }
    return request;
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.labRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: labRequestWithBillingInclude,
    });
  }

  async update(id: string, dto: UpdateLabRequestDto) {
    const existing = await this.prisma.labRequest.findUnique({
      where: { id },
      include: {
        invoiceItem: { include: { labOrder: { select: { id: true } } } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }

    if (dto.status === LabRequestStatus.CANCELLED) {
      if (existing.status === LabRequestStatus.CANCELLED) {
        return this.findOne(id);
      }
      this.assertLabRequestCancellable(existing);
      return this.prisma.$transaction(async (tx) => {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          existing.invoiceItemId,
          tx,
        );
        return tx.labRequest.update({
          where: { id },
          data: { ...dto, status: LabRequestStatus.CANCELLED },
          include: labRequestWithBillingInclude,
        });
      });
    }

    return this.prisma.labRequest.update({
      where: { id },
      data: dto,
      include: labRequestWithBillingInclude,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.labRequest.findUnique({
      where: { id },
      include: {
        invoiceItem: { include: { labOrder: { select: { id: true } } } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }
    this.assertLabRequestCancellable(existing);

    await this.prisma.$transaction(async (tx) => {
      await this.invoiceService.removeBillableLineForEncounterRequest(
        existing.invoiceItemId,
        tx,
      );
      await tx.labRequest.delete({ where: { id } });
    });
    return { message: 'Lab request removed successfully.' };
  }

  private assertLabRequestCancellable(request: {
    status: LabRequestStatus;
    invoiceItem: { labOrder: { id: string } | null } | null;
  }) {
    if (request.invoiceItem?.labOrder) {
      throw new BadRequestException(
        'Cannot remove this lab request: a lab order has already been created for the billed test.',
      );
    }
    if (request.status === LabRequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot remove a completed lab request.',
      );
    }
  }
}
