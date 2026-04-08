import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWaitingPatientDto,
  QueryWaitingPatientDto,
  SendToConsultingRoomDto,
  UpdateWaitingPatientDto,
} from './dto/waiting-patient.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { CONSULTATION_BILLING_CATEGORY } from '../invoice/invoice-link.constants';

@Injectable()
export class WaitingPatientService {
  constructor(private readonly prisma: PrismaService) { }

  private queueBaseWhere(dateRange?: { from: Date; to: Date }): Prisma.InvoiceWhereInput {
    return {
      ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
      status: 'PAID',
      patient: {
        patientId: { not: null },
        NOT: { patientId: '' },
      },
      invoiceItems: {
        some: {
          settled: false,
          service: {
            category: {
              name: {
                equals: CONSULTATION_BILLING_CATEGORY,
                mode: 'insensitive',
              },
            },
          },
        },
      },
    };
  }

  private queueInclude = {
    patient: {
      select: {
        id: true,
        firstName: true,
        surname: true,
        email: true,
        patientId: true
      }
    },
    consultingRoom: { select: { id: true, name: true } },
    vitals: true,
    encounter: { select: { id: true, status: true, startTime: true } },
    invoiceItems: {
      where: {
        settled: false,
        service: {
          category: {
            name: {
              equals: CONSULTATION_BILLING_CATEGORY,
              mode: 'insensitive',
            },
          },
        },
      },
      select: {
        id: true,
        serviceId: true,
        settled: true,
        service: { select: { id: true, name: true } },
      },
    },
  } satisfies Prisma.InvoiceInclude;

  private toQueueRow(inv: any) {
    return {
      id: inv.id,
      invoiceId: inv.id,
      invoiceID: inv.invoiceID,
      patientId: inv.patientId,
      consultingRoomId: inv.consultingRoomId ?? null,
      seen: Boolean(inv.encounterId),
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      patient: inv.patient,
      consultingRoom: inv.consultingRoom ?? null,
      vitals: inv.vitals ?? null,
      encounter: inv.encounter ?? null,
      consultationServices: (inv.invoiceItems ?? []).map((it: any) => ({
        invoiceItemId: it.id,
        serviceId: it.serviceId ?? null,
        settled: Boolean(it.settled),
        name: it.service?.name ?? null,
      })),
      invoice: inv,
    };
  }

  async create(_dto: CreateWaitingPatientDto) {
    throw new GoneException(
      'Waiting-patient creation is deprecated. Queue rows are now derived from paid consultation invoices.',
    );
  }

  async findAll(query: QueryWaitingPatientDto) {
    const {
      consultingRoomId,
      patientId,
      unassignedOnly,
      seen,
      skip = 0,
      take = 20,
      toDate,
      fromDate,
    } = query;

    const dateRange =
      fromDate || toDate ? parseDateRange(fromDate, toDate) : undefined;
    const where: Prisma.InvoiceWhereInput = this.queueBaseWhere(dateRange);
    if (consultingRoomId) {
      where.consultingRoomId = consultingRoomId;
    } else if (unassignedOnly) {
      where.consultingRoomId = null;
    } else if (unassignedOnly === false) {
      where.consultingRoomId = { not: null };
    }

    if (seen === true) where.encounterId = { not: null };
    if (seen === false) where.encounterId = null;
    if (patientId) where.patientId = patientId;

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: this.queueInclude,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data: rows.map((r) => this.toQueueRow(r)), total, skip, take };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { ...this.queueBaseWhere(), id },
      include: this.queueInclude,
    });
    if (!inv) {
      throw new NotFoundException(`Queue entry for invoice "${id}" not found.`);
    }
    return this.toQueueRow(inv);
  }

  async sendToConsultingRoom(id: string, dto: SendToConsultingRoomDto) {
    const row = await this.findOne(id);
    if (!row.vitals) {
      throw new BadRequestException(
        'Vitals must be linked to this invoice before sending to consulting room.',
      );
    }
    const room = await this.prisma.consultingRoom.findUnique({
      where: { id: dto.consultingRoomId },
    });
    if (!room) {
      throw new NotFoundException(
        `Consulting room "${dto.consultingRoomId}" not found.`,
      );
    }
    if (dto.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        consultingRoomId: dto.consultingRoomId,
        ...(dto.staffId ? { updatedById: dto.staffId } : {}),
      },
      include: this.queueInclude,
    });
    return this.toQueueRow(updated);
  }

  async findByConsultingRoom(consultingRoomId: string) {
    const room = await this.prisma.consultingRoom.findUnique({
      where: { id: consultingRoomId },
    });
    if (!room) {
      throw new NotFoundException(
        `Consulting room "${consultingRoomId}" not found.`,
      );
    }

    const rows = await this.prisma.invoice.findMany({
      where: {
        ...this.queueBaseWhere(),
        consultingRoomId,
      },
      orderBy: { createdAt: 'asc' },
      include: this.queueInclude,
    });
    return rows.map((r) => this.toQueueRow(r));
  }

  async update(id: string, dto: UpdateWaitingPatientDto) {
    await this.findOne(id);
    if (dto.seen !== undefined) {
      throw new BadRequestException(
        'Seen flag is encounter-driven. Link encounterId on invoice instead.',
      );
    }
    if (dto.consultingRoomId) {
      const room = await this.prisma.consultingRoom.findUnique({
        where: { id: dto.consultingRoomId },
      });
      if (!room) {
        throw new NotFoundException(
          `Consulting room "${dto.consultingRoomId}" not found.`,
        );
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.consultingRoomId !== undefined && {
          consultingRoomId: dto.consultingRoomId,
        }),
        ...(dto.staffId ? { updatedById: dto.staffId } : {}),
      },
      include: this.queueInclude,
    });
    return this.toQueueRow(updated);
  }

  async remove(_id: string) {
    throw new GoneException(
      'Queue entries are derived from invoices and cannot be deleted here.',
    );
  }
}

