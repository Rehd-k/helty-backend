import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWaitingPatientDto,
  QueryWaitingPatientDto,
  SendToConsultingRoomDto,
  UpdateWaitingPatientDto,
} from './dto/waiting-patient.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { buildPatientNameSearchWhere } from '../../common/utils/patient-name-search.util';
import {
  CONSULTATION_BILLING_CATEGORY,
  CONSULTATION_CREDIT_MAX_VISITS,
} from '../invoice/invoice-link.constants';

@Injectable()
export class WaitingPatientService {
  constructor(private readonly prisma: PrismaService) { }

  private consumableConsultationItemWhere(): Prisma.InvoiceItemWhereInput {
    const now = new Date();
    return {
      settled: false,
      consultationVisitsConsumed: { lt: CONSULTATION_CREDIT_MAX_VISITS },
      consultationCreditExpiresAt: { gt: now },
      service: {
        category: {
          name: {
            equals: CONSULTATION_BILLING_CATEGORY,
            mode: 'insensitive',
          },
        },
      },
    };
  }

  private queueBaseWhere(
    dateRange?: { from: Date; to: Date },
    opts?: { unregisteredOnly?: boolean },
  ): Prisma.InvoiceWhereInput {
    const patientWhere: Prisma.PatientWhereInput = opts?.unregisteredOnly
      ? {
        status: PatientStatus.OUTPATIENT,
        OR: [{ patientId: null }, { patientId: '' }],
      }
      : {
        status: PatientStatus.OUTPATIENT,
        patientId: { not: null },
        NOT: { patientId: '' },
      };

    return {
      ...(dateRange
        ? { updatedAt: { gte: dateRange.from, lte: dateRange.to } }
        : {}),
      status: 'PAID',
      patient: patientWhere,
      invoiceItems: {
        some: this.consumableConsultationItemWhere(),
      },
    };
  }

  private buildQueueSearchOr(q: string): Prisma.InvoiceWhereInput[] {
    const needle = { contains: q, mode: 'insensitive' as const };
    return [
      { invoiceID: needle },
      {
        patient: {
          OR: [
            buildPatientNameSearchWhere(q),
            { patientId: needle },
          ],
        },
      },
      {
        invoiceItems: {
          some: {
            ...this.consumableConsultationItemWhere(),
            service: { name: needle },
          },
        },
      },
    ];
  }

  private queueInclude(): Prisma.InvoiceInclude {
    return {
      patient: {
        select: {
          ...patientNameFieldsSelect,
          email: true,
        },
      },
      consultingRoom: { select: { id: true, name: true } },
      vitals: true,
      encounter: { select: { id: true, status: true, startTime: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true } },
      invoiceItems: {
        where: this.consumableConsultationItemWhere(),
        select: {
          id: true,
          serviceId: true,
          settled: true,
          consultationVisitsConsumed: true,
          consultationCreditExpiresAt: true,
          service: { select: { id: true, name: true } },
        },
      },
    };
  }

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
        visitsConsumed: it.consultationVisitsConsumed ?? 0,
        visitsRemaining: Math.max(
          0,
          CONSULTATION_CREDIT_MAX_VISITS -
            (it.consultationVisitsConsumed ?? 0),
        ),
        expiresAt: it.consultationCreditExpiresAt?.toISOString?.() ??
          it.consultationCreditExpiresAt ??
          null,
      })),
      updatedBy: inv.updatedBy ?? null,
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
      unregisteredOnly,
      seen,
      skip = 0,
      take = 20,
      toDate,
      fromDate,
      q,
    } = query;

    const dateRange =
      fromDate || toDate ? parseDateRange(fromDate, toDate) : undefined;
    const where: Prisma.InvoiceWhereInput = this.queueBaseWhere(dateRange, {
      unregisteredOnly: unregisteredOnly === true,
    });
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

    const searchTerm = q?.trim();
    if (searchTerm) {
      where.OR = this.buildQueueSearchOr(searchTerm);
    }
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: this.queueInclude(),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: rows.map((r) => this.toQueueRow(r)), total, skip, take };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { ...this.queueBaseWhere(), id },
      include: this.queueInclude(),
    });
    if (!inv) {
      throw new NotFoundException(`Queue entry for invoice "${id}" not found.`);
    }
    return this.toQueueRow(inv);
  }

  async sendToConsultingRoom(
    id: string,
    dto: SendToConsultingRoomDto,
    staffId: string,
  ) {
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
        updatedById: staffId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
      },
      include: this.queueInclude(),
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
      include: this.queueInclude(),
    });
    return rows.map((r) => this.toQueueRow(r));
  }

  async update(id: string, dto: UpdateWaitingPatientDto, staffId: string) {
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
        updatedById: staffId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
      },
      include: this.queueInclude(),
    });
    return this.toQueueRow(updated);
  }

  async remove(_id: string) {
    throw new GoneException(
      'Queue entries are derived from invoices and cannot be deleted here.',
    );
  }
}
