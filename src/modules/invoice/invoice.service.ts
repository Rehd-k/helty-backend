import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddInvoiceItemDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
} from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Invoice CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new invoice for a patient.
   * The authenticated staff member is recorded as `createdBy`.
   */
  async create(dto: CreateInvoiceDto, req: any) {
    return this.prisma.invoice.create({
      data: {
        patientId: dto.patientId,
        status: dto.status,
        createdById: req.user.sub,
        staffId: dto.staffId ?? '',
        encounterId: dto.encounterId ?? undefined,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
  }

  /**
   * Paginated list of all invoices, most-recent first.
   */
  async findAll(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
     const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { createdAt: { gte: from, lte: to } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          // encounter: true,
          invoiceItems: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  cost: true,
                },
              },
              drug: true,
            },
          },
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              surname: true,
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { invoiceItems: true } },
        },
      }),
      this.prisma.invoice.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
    ]);
    return { invoices, total, skip, take };
  }

  /**
   * All invoices for a single patient, including line items.
   */
  async findByPatient(patientId: string) {
    return this.prisma.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
  }

  /**
   * Full invoice detail with computed `totalAmount`.
   */
  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            surname: true,
            phoneNumber: true,
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        staff: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        invoiceItems: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                cost: true,
                category: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    const totalAmount = invoice.invoiceItems.reduce(
      (sum, item) => sum + item.priceAtTime * item.quantity,
      0,
    );

    return { ...invoice, totalAmount };
  }

  /**
   * Update invoice status or associated staff.
   * Authenticated staff member is recorded as `updatedBy`.
   */
  async update(id: string, dto: UpdateInvoiceDto, req: any) {
    await this.findOne(id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        staffId: dto.staffId,
        updatedById: req.user.sub,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
  }

  /**
   * Delete an invoice. Fails if it still has line items.
   */
  async remove(id: string) {
    await this.findOne(id);
    const itemCount = await this.prisma.invoiceItem.count({
      where: { invoiceId: id },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete invoice: it has ${itemCount} line item(s). Remove them first.`,
      );
    }
    return this.prisma.invoice.delete({ where: { id } });
  }

  // ─── InvoiceItem CRUD ──────────────────────────────────────────────────────────

  /**
   * Add a service as a line item to an invoice.
   * Both invoice and service are validated to exist.
   */
  async addItem(invoiceId: string, dto: AddInvoiceItemDto) {
    await this.findOne(invoiceId);

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service)
      throw new NotFoundException(`Service ${dto.serviceId} not found`);

    return this.prisma.invoiceItem.create({
      data: {
        invoiceId,
        serviceId: dto.serviceId,
        quantity: dto.quantity ?? 1,
        priceAtTime: dto.priceAtTime,
      },
      include: {
        service: {
          select: { id: true, name: true, description: true, cost: true },
        },
        invoice: { select: { id: true, status: true, patientId: true } },
      },
    });
  }

  /**
   * Update a line item's quantity or price snapshot.
   */
  async updateItem(
    invoiceId: string,
    itemId: string,
    dto: UpdateInvoiceItemDto,
  ) {
    const existing = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }

    return this.prisma.invoiceItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity ?? existing.quantity,
        priceAtTime: dto.priceAtTime ?? existing.priceAtTime,
      },
      include: {
        service: { select: { id: true, name: true, cost: true } },
      },
    });
  }

  /**
   * Remove a line item from an invoice.
   */
  async removeItem(invoiceId: string, itemId: string) {
    const existing = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }
    return this.prisma.invoiceItem.delete({ where: { id: itemId } });
  }

  // ─── Auto-invoice from requests (lab, imaging, radiology, procedure, medication) ─

  /**
   * Find an invoice by encounter ID (used for medication: same encounter = same invoice).
   */
  async findByEncounterId(encounterId: string) {
    return this.prisma.invoice.findFirst({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
            drug: { select: { id: true, genericName: true } },
          },
        },
      },
    });
  }

  /**
   * Get existing invoice for encounter or create a new one. Used for medication orders:
   * same encounterId → add items to existing invoice instead of creating a new one.
   */
  async ensureInvoiceForEncounter(params: {
    encounterId: string;
    patientId: string;
    staffId: string;
  }) {
    const existing = await this.findByEncounterId(params.encounterId);
    if (existing) return existing;
    return this.prisma.invoice.create({
      data: {
        patientId: params.patientId,
        encounterId: params.encounterId,
        status: TransactionStatus.DRAFT,
        createdById: params.staffId,
        staffId: params.staffId,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        invoiceItems: true,
      },
    });
  }

  /**
   * Create a new invoice with one service line item. Used after lab, imaging, radiology, or procedure requests.
   */
  async createWithServiceItem(params: {
    patientId: string;
    encounterId: string;
    staffId: string;
    serviceId: string;
    quantity?: number;
  }) {
    const service = await this.prisma.service.findUnique({
      where: { id: params.serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Service ${params.serviceId} not found`);
    }
    const quantity = params.quantity ?? 1;
    return this.prisma.invoice.create({
      data: {
        patientId: params.patientId,
        encounterId: params.encounterId,
        status: TransactionStatus.DRAFT,
        createdById: params.staffId,
        staffId: params.staffId,
        invoiceItems: {
          create: {
            serviceId: params.serviceId,
            quantity,
            priceAtTime: service.cost,
          },
        },
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
  }

  /**
   * Add a drug as a line item to an invoice. Uses selling price from an available batch.
   */
  async addDrugItem(params: {
    invoiceId: string;
    drugId: string;
    quantity?: number;
  }) {
    await this.findOne(params.invoiceId);
    const drug = await this.prisma.drug.findUnique({
      where: { id: params.drugId },
      include: {
        batches: {
          where: { quantityRemaining: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
          take: 1,
        },
      },
    });
    if (!drug) throw new NotFoundException(`Drug ${params.drugId} not found`);
    const batch = drug.batches?.[0];
    const priceAtTime = batch ? Number(batch.sellingPrice) : 0;
    const quantity = params.quantity ?? 1;
    return this.prisma.invoiceItem.create({
      data: {
        invoiceId: params.invoiceId,
        drugId: params.drugId,
        quantity,
        priceAtTime,
      },
      include: {
        drug: { select: { id: true, genericName: true } },
        invoice: { select: { id: true, status: true, patientId: true } },
      },
    });
  }
}
