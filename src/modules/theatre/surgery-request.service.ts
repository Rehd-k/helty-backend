import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SurgeryRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  CreateSurgeryRequestDto,
  ListSurgeryRequestsQueryDto,
  UpdateSurgeryRequestDto,
} from './dto/create-surgery-request.dto';
import { surgeryRequestSummaryInclude } from './surgery-request-includes';

@Injectable()
export class SurgeryRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateSurgeryRequestDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException('Patient does not match the encounter.');
    }

    const [requestedBy, service] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: dto.requestedById } }),
      this.prisma.service.findUnique({ where: { id: dto.serviceId } }),
    ]);
    if (!requestedBy) {
      throw new NotFoundException(
        `Staff "${dto.requestedById}" not found.`,
      );
    }
    if (!service) {
      throw new NotFoundException(`Service "${dto.serviceId}" not found.`);
    }

    await this.invoiceService.assertServiceCategoryForProcedureBilling(
      dto.serviceId,
    );

    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
      });
      if (!admission) {
        throw new NotFoundException(
          `Admission "${dto.admissionId}" not found.`,
        );
      }
      if (admission.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Admission does not belong to this patient.',
        );
      }
      if (admission.dischargeDate) {
        throw new BadRequestException(
          'Cannot link surgery to a discharged admission.',
        );
      }
    }

    return this.prisma.surgeryRequest.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        requestedById: dto.requestedById,
        serviceId: dto.serviceId,
        admissionId: dto.admissionId ?? null,
        priority: dto.priority,
        clinicalNotes: dto.clinicalNotes ?? null,
        preferredDate: dto.preferredDate
          ? new Date(dto.preferredDate)
          : null,
        status: SurgeryRequestStatus.REQUESTED,
      },
      include: surgeryRequestSummaryInclude,
    });
  }

  async findAll(query: ListSurgeryRequestsQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: {
      encounterId?: string;
      patientId?: string;
      status?: SurgeryRequestStatus;
      createdAt?: { gte: Date; lte: Date };
    } = {};

    if (query.encounterId) where.encounterId = query.encounterId;
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;
    if (query.fromDate && query.toDate) {
      const { from, to } = parseDateRange(query.fromDate, query.toDate);
      where.createdAt = { gte: from, lte: to };
    }

    const [data, total] = await Promise.all([
      this.prisma.surgeryRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: surgeryRequestSummaryInclude,
      }),
      this.prisma.surgeryRequest.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.surgeryRequest.findUnique({
      where: { id },
      include: surgeryRequestSummaryInclude,
    });
    if (!request) {
      throw new NotFoundException(`Surgery request "${id}" not found.`);
    }
    return request;
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.surgeryRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: surgeryRequestSummaryInclude,
    });
  }

  async update(id: string, dto: UpdateSurgeryRequestDto) {
    const existing = await this.findOne(id);

    if (dto.status === SurgeryRequestStatus.CANCELLED) {
      if (
        existing.status !== SurgeryRequestStatus.REQUESTED &&
        existing.status !== SurgeryRequestStatus.SCHEDULED
      ) {
        throw new BadRequestException(
          'Only requested or scheduled surgery requests can be cancelled.',
        );
      }
    } else if (dto.status && dto.status !== existing.status) {
      throw new BadRequestException(
        'Status changes are managed by theatre workflow endpoints.',
      );
    }

    return this.prisma.surgeryRequest.update({
      where: { id },
      data: {
        priority: dto.priority,
        clinicalNotes: dto.clinicalNotes,
        preferredDate:
          dto.preferredDate !== undefined
            ? dto.preferredDate
              ? new Date(dto.preferredDate)
              : null
            : undefined,
        status: dto.status,
      },
      include: surgeryRequestSummaryInclude,
    });
  }
}
