import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    AddInvoiceItemDto,
    CreateInvoiceDto,
    UpdateInvoiceDto,
    UpdateInvoiceItemDto,
} from './dto/invoice.dto';

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
                staffId: dto.staffId,
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
    async findAll(skip = 0, take = 20) {
        const [invoices, total] = await Promise.all([
            this.prisma.invoice.findMany({
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    patient: {
                        select: { id: true, patientId: true, firstName: true, surname: true },
                    },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { invoiceItems: true } },
                },
            }),
            this.prisma.invoice.count(),
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
        if (!service) throw new NotFoundException(`Service ${dto.serviceId} not found`);

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
    async updateItem(invoiceId: string, itemId: string, dto: UpdateInvoiceItemDto) {
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
}
