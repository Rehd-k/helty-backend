import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsumableUsageSource,
  DialysisSessionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import { InvoiceService } from '../invoice/invoice.service';
import { invoiceLinkException } from '../../common/exceptions/invoice-link.exception';
import { ConsumableUsageService } from '../store/consumable-usage.service';
import { isDialysisHeadRole } from './dialysis.constants';
import { CreateDialysisSessionDto } from './dto/create-dialysis-session.dto';
import { UpdateDialysisSessionDto } from './dto/update-dialysis-session.dto';
import { ListDialysisSessionsQueryDto } from './dto/list-dialysis-sessions-query.dto';
import { AddSessionConsumableDto } from './dto/add-session-consumable.dto';
import {
  dialysisSessionConsumableInclude,
  dialysisSessionSummaryInclude,
} from './dialysis-session-includes';

@Injectable()
export class DialysisSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly consumableUsage: ConsumableUsageService,
  ) {}

  async create(dto: CreateDialysisSessionDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }

    if (dto.doctorId) {
      const doctor = await this.prisma.staff.findUnique({
        where: { id: dto.doctorId },
      });
      if (!doctor) {
        throw new NotFoundException(`Doctor "${dto.doctorId}" not found.`);
      }
    }

    const hasInvoiceLink = !!(
      dto.invoiceId ||
      dto.invoiceItemId ||
      dto.serviceId
    );
    if (hasInvoiceLink) {
      if (!dto.invoiceId || !dto.invoiceItemId || !dto.serviceId) {
        throw invoiceLinkException(
          'INVALID_INVOICE_LINK_PAYLOAD',
          'invoiceId, invoiceItemId, and serviceId must all be provided together.',
        );
      }
      return this.prisma.$transaction(async (tx) => {
        await this.invoiceService.assertPaidInvoiceItemConsumable(
          tx,
          {
            invoiceId: dto.invoiceId!,
            invoiceItemId: dto.invoiceItemId!,
            serviceId: dto.serviceId!,
            patientId: dto.patientId,
            mode: 'dialysis',
          },
          { requirePayment: false },
        );
        return tx.dialysisSession.create({
          data: {
            patientId: dto.patientId,
            doctorId: dto.doctorId ?? null,
            status: DialysisSessionStatus.PENDING,
            invoiceId: dto.invoiceId!,
            invoiceItemId: dto.invoiceItemId!,
            serviceId: dto.serviceId!,
            notes: dto.notes ?? null,
          },
          include: dialysisSessionSummaryInclude,
        });
      });
    }

    return this.prisma.dialysisSession.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId ?? null,
        status: DialysisSessionStatus.PENDING,
        notes: dto.notes ?? null,
      },
      include: dialysisSessionSummaryInclude,
    });
  }

  async findAll(query: ListDialysisSessionsQueryDto) {
    const where: Prisma.DialysisSessionWhereInput = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;
    if (query.fromDate || query.toDate) {
      const { from, to } = parseDateRange(query.fromDate, query.toDate);
      where.createdAt = { gte: from, lte: to };
    }

    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const [sessions, total] = await Promise.all([
      this.prisma.dialysisSession.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: dialysisSessionSummaryInclude,
      }),
      this.prisma.dialysisSession.count({ where }),
    ]);

    return { sessions, total };
  }

  async findOne(id: string) {
    const session = await this.prisma.dialysisSession.findUnique({
      where: { id },
      include: {
        ...dialysisSessionSummaryInclude,
        consumables: {
          include: dialysisSessionConsumableInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`Dialysis session "${id}" not found.`);
    }
    return session;
  }

  async update(
    id: string,
    dto: UpdateDialysisSessionDto,
    staffId: string,
    staffRole?: string,
  ) {
    const session = await this.findOne(id);

    if (dto.status === DialysisSessionStatus.CANCELLED) {
      if (!isDialysisHeadRole(staffRole)) {
        throw new ForbiddenException(
          'Only dialysis head can cancel sessions.',
        );
      }
      if (
        session.status !== DialysisSessionStatus.PENDING &&
        session.status !== DialysisSessionStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Only pending or in-progress sessions can be cancelled.',
        );
      }
    }

    const now = new Date();
    const data: Prisma.DialysisSessionUpdateInput = { ...dto };

    if (dto.status === DialysisSessionStatus.IN_PROGRESS) {
      if (!session.startedAt) {
        data.startedAt = now;
      }
      if (!dto.performedById && !session.performedById) {
        data.performedBy = { connect: { id: staffId } };
      }
    }

    if (dto.status === DialysisSessionStatus.COMPLETED) {
      data.completedAt = now;
    }

    if (dto.performedById) {
      const performer = await this.prisma.staff.findUnique({
        where: { id: dto.performedById },
      });
      if (!performer) {
        throw new NotFoundException(
          `Staff "${dto.performedById}" not found.`,
        );
      }
    }

    return this.prisma.dialysisSession.update({
      where: { id },
      data,
      include: dialysisSessionSummaryInclude,
    });
  }

  async addConsumable(
    sessionId: string,
    dto: AddSessionConsumableDto,
    staffId: string,
  ) {
    const session = await this.prisma.dialysisSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        patientId: true,
        status: true,
        invoiceId: true,
      },
    });
    if (!session) {
      throw new NotFoundException(`Dialysis session "${sessionId}" not found.`);
    }

    if (
      session.status !== DialysisSessionStatus.IN_PROGRESS &&
      session.status !== DialysisSessionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Consumables can only be added to in-progress or completed sessions.',
      );
    }

    const billable = dto.billable !== false;
    const quantity = dto.quantity;
    const unitPrice = dto.unitPrice ?? 0;

    if (billable) {
      let invoiceId: string | null = session.invoiceId;
      if (invoiceId) {
        const linked = await this.prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, status: true, patientId: true },
        });
        const linkedOpen =
          !!linked &&
          linked.patientId === session.patientId &&
          (linked.status === 'PENDING' || linked.status === 'PARTIALLY_PAID');
        if (!linkedOpen) {
          invoiceId = null;
        }
      }
      if (!invoiceId) {
        const open = await this.invoiceService.ensureOpenInvoiceForPatient(
          session.patientId,
          staffId,
        );
        invoiceId = open.id;
      }

      const invoiceItem = await this.invoiceService.addItem(
        invoiceId,
        {
          consumableId: dto.consumableId,
          storeLocationId: dto.storeLocationId,
          quantity,
          unitPrice,
        },
        staffId,
      );

      return this.prisma.dialysisSessionConsumable.create({
        data: {
          sessionId,
          consumableId: dto.consumableId,
          storeLocationId: dto.storeLocationId,
          quantity,
          unitPrice,
          invoiceId,
          invoiceItemId: invoiceItem.id,
          createdById: staffId,
        },
        include: dialysisSessionConsumableInclude,
      });
    }

    const usageEvent = await this.consumableUsage.recordNonBillableUse(
      {
        consumableId: dto.consumableId,
        storeLocationId: dto.storeLocationId,
        patientId: session.patientId,
        source: ConsumableUsageSource.NURSING,
        quantity,
      },
      staffId,
    );

    return this.prisma.dialysisSessionConsumable.create({
      data: {
        sessionId,
        consumableId: dto.consumableId,
        storeLocationId: dto.storeLocationId,
        quantity,
        unitPrice,
        usageEventId: usageEvent.id,
        createdById: staffId,
      },
      include: dialysisSessionConsumableInclude,
    });
  }
}
