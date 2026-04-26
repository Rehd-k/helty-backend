import {
    Injectable,
    NotFoundException,
    BadRequestException,
    HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, InvoiceStatus } from '@prisma/client';
import {
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from '../pharmacy/pharmacy-sellable-stock.util';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import {
    UpdateInvoiceDto,
    UpdateInvoiceItemDto,
    SubstituteDrugInvoiceItemDto,
} from './dto/invoice.dto';

@Injectable()
export class InvoiceDrugService {
    constructor(private readonly prisma: PrismaService) { }

    private static readonly invoiceItemCreatedBySelect = {
        id: true,
        firstName: true,
        lastName: true,
    } as const;

    private readonly dayMs = 24 * 60 * 60 * 1000;

    private asDecimal(value: number | string | Prisma.Decimal) {
        return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
    }

    private assertInvoiceNotPaid(status: InvoiceStatus) {
        if (status === InvoiceStatus.PAID) {
            throw new BadRequestException(
                'This invoice is paid and cannot be modified.',
            );
        }
    }

    private async hasDrugItems(invoiceId: string): Promise<boolean> {
        const count = await this.prisma.invoiceItem.count({
            where: { invoiceId, drugId: { not: null } },
        });
        return count > 0;
    }

    /**
     * Reduce quantityRemaining across batches (earliest manufacturingDate, then createdAt),
     * skipping batches with zero remaining until enough units are taken.
     */
    private async deductDrugStockFifo(
        tx: Prisma.TransactionClient,
        drugId: string,
        quantityToDeduct: number,
    ) {
        if (quantityToDeduct <= 0) return;

        const sellableWhere = await getSellableDrugBatchWhere(tx);
        const batches = await tx.drugBatch.findMany({
            where: mergeDrugBatchWhere(sellableWhere, {
                drugId,
                quantityRemaining: { gt: 0 },
            }),
            orderBy: [{ manufacturingDate: 'asc' }, { createdAt: 'asc' }],
        });

        const totalAvailable = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
        if (totalAvailable < quantityToDeduct) {
            throw new BadRequestException(
                `Insufficient stock for this drug: need ${quantityToDeduct} unit(s), ` +
                    `${totalAvailable} available across batches.`,
            );
        }

        let remaining = quantityToDeduct;
        for (const batch of batches) {
            if (remaining <= 0) break;
            const take = Math.min(batch.quantityRemaining, remaining);
            if (take <= 0) continue;
            await tx.drugBatch.update({
                where: { id: batch.id },
                data: { quantityRemaining: batch.quantityRemaining - take },
            });
            remaining -= take;
        }
    }

    private invoiceLineTotal(
        item: {
            unitPrice: Prisma.Decimal;
            quantity: number;
            isRecurringDaily: boolean;
            usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
        },
        now: Date,
    ) {
        const unitPrice = this.asDecimal(item.unitPrice);
        if (item.isRecurringDaily) {
            const totalDays = this.computeRecurringDays(item.usageSegments, now);
            return unitPrice.mul(totalDays);
        }
        return unitPrice.mul(item.quantity);
    }

    private computeRecurringDays(
        segments: Array<{ startAt: Date; endAt: Date | null }>,
        now: Date,
    ) {
        let totalDays = 0;
        for (const segment of segments) {
            const endAt = segment.endAt ?? now;
            const duration = endAt.getTime() - segment.startAt.getTime();
            if (duration <= 0) continue;
            const isOpen = segment.endAt === null;
            const days = isOpen
                ? Math.floor(duration / this.dayMs)
                : Math.ceil(duration / this.dayMs);
            totalDays += days;
        }
        return totalDays;
    }

    async recalculateInvoiceTotals(
        invoiceId: string,
        tx: Prisma.TransactionClient = this.prisma,
        now: Date = new Date(),
    ) {
        const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                invoiceItems: {
                    include: {
                        usageSegments: {
                            orderBy: { startAt: 'asc' },
                        },
                    },
                },
            },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

        const totalAmount = invoice.invoiceItems.reduce((sum, item) => {
            const unitPrice = this.asDecimal(item.unitPrice);
            if (item.isRecurringDaily) {
                const totalDays = this.computeRecurringDays(item.usageSegments, now);
                return sum.add(unitPrice.mul(totalDays));
            }
            return sum.add(unitPrice.mul(item.quantity));
        }, new Prisma.Decimal(0));

        const amountPaid = this.asDecimal(invoice.amountPaid);
        let status: InvoiceStatus = InvoiceStatus.PENDING;
        if (totalAmount.gt(0) && amountPaid.gte(totalAmount)) {
            status = InvoiceStatus.PAID;
        } else if (amountPaid.gt(0)) {
            status = InvoiceStatus.PARTIALLY_PAID;
        }

        return tx.invoice.update({
            where: { id: invoiceId },
            data: { totalAmount, status },
        });
    }

    private static readonly invoiceDrugInclude = {
        staff: {
            select: { id: true, firstName: true, lastName: true },
        },
        invoiceItems: {
            include: {
                service: {
                    select: { id: true, name: true, cost: true },
                },
                drug: {
                    select: {
                        id: true,
                        genericName: true,
                        brandName: true,
                        strength: true,
                        dosageForm: true,
                    },
                },
                createdBy: { select: InvoiceDrugService.invoiceItemCreatedBySelect },
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
    } satisfies Prisma.InvoiceInclude;

    async findAllDrugInvoices(
        params: DateRangeSkipTakeDto & {
            search?: string;
            category?: string;
            query?: string;
        },
    ) {
        const { skip = 0, take = 20, fromDate, toDate, query, category } = params;
        const { from, to } = parseDateRange(fromDate, toDate);

        const updatedAt: Prisma.DateTimeFilter = { gte: from, lte: to };
        const q = query?.trim();
        let where: Prisma.InvoiceWhereInput = {
            updatedAt,
            invoiceItems: {
                some: { drugId: { not: null } },
            },
        };

        if (q) {
            const needle = { contains: q, mode: 'insensitive' as const };

            if (category === 'patientId') {
                where = {
                    ...where,
                    patient: { patientId: needle },
                };
            } else if (category === 'fullName') {
                where = {
                    ...where,
                    patient: {
                        OR: [{ firstName: needle }, { surname: needle }],
                    },
                };
            } else if (category === 'service') {
                where = {
                    ...where,
                    invoiceItems: {
                        some: {
                            OR: [
                                { service: { name: needle } },
                                { drug: { genericName: needle } },
                                { drug: { brandName: needle } },
                            ],
                        },
                    },
                };
            } else {
                where = {
                    ...where,
                    AND: [
                        {
                            OR: [
                                {
                                    patient: {
                                        OR: [
                                            { firstName: needle },
                                            { surname: needle },
                                            { patientId: needle },
                                        ],
                                    },
                                },
                                {
                                    invoiceItems: {
                                        some: {
                                            OR: [
                                                { service: { name: needle } },
                                                { drug: { genericName: needle } },
                                                { drug: { brandName: needle } },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                };
            }
        }

        const [invoices, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                skip: Number(skip),
                take: Number(take),
                orderBy: { createdAt: 'desc' },
                include: InvoiceDrugService.invoiceDrugInclude,
            }),
            this.prisma.invoice.count({ where }),
        ]);
        return { invoices, total, skip, take };
    }

    async findOneDrugInvoice(id: string) {
        const hasDrugs = await this.hasDrugItems(id);
        if (!hasDrugs) {
            throw new NotFoundException(`Invoice ${id} does not contain drug items`);
        }
        await this.recalculateInvoiceTotals(id);
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
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        staffRole: true,
                        accountType: true,
                    },
                },
                updatedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        staffRole: true,
                        accountType: true,
                    },
                },
                staff: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        staffRole: true,
                        accountType: true,
                    },
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
                        drug: {
                            select: {
                                id: true,
                                genericName: true,
                                brandName: true,
                                strength: true,
                                dosageForm: true,
                            },
                        },
                        usageSegments: true,
                        createdBy: { select: InvoiceDrugService.invoiceItemCreatedBySelect },
                    },
                },
                payments: {
                    orderBy: { createdAt: 'desc' },
                },
                refunds: {
                    orderBy: { refundedAt: 'desc' },
                    include: {
                        processedBy: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                    },
                },
            },
        });

        if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
        const amountDue = this.asDecimal(invoice.totalAmount).sub(
            invoice.amountPaid,
        );
        const now = new Date();
        const invoiceItems = invoice.invoiceItems.map((item) => {
            const lineTotal = this.invoiceLineTotal(item, now);
            const paid = this.asDecimal(item.amountPaid);
            return {
                ...item,
                lineTotal,
                lineAmountDue: lineTotal.sub(paid),
            };
        });
        return { ...invoice, invoiceItems, amountDue };
    }

    async updateDrugInvoice(id: string, dto: UpdateInvoiceDto, req: any) {
        const hasDrugs = await this.hasDrugItems(id);
        if (!hasDrugs) {
            throw new NotFoundException(`Invoice ${id} does not contain drug items`);
        }
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
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
                        drug: {
                            select: {
                                id: true,
                                genericName: true,
                                brandName: true,
                                strength: true,
                                dosageForm: true,
                            },
                        },
                        createdBy: { select: InvoiceDrugService.invoiceItemCreatedBySelect },
                    },
                },
            },
        });
    } 

    async removeDrugInvoice(id: string) {
        const hasDrugs = await this.hasDrugItems(id);
        if (!hasDrugs) {
            throw new NotFoundException(`Invoice ${id} does not contain drug items`);
        }
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
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

    async updateDrugInvoiceItem(
        invoiceId: string,
        itemId: string,
        dto: UpdateInvoiceItemDto,
    ) {
        try {
            const hasDrugs = await this.hasDrugItems(invoiceId);
            if (!hasDrugs) {
                throw new NotFoundException(`Invoice ${invoiceId} does not contain drug items`);
            }
            const invoice = await this.prisma.invoice.findUnique({
                where: { id: invoiceId },
            });
            if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

            if (dto.settled === undefined) {
                this.assertInvoiceNotPaid(invoice.status);
            }
            const existing = await this.prisma.invoiceItem.findFirst({
                where: { id: itemId, invoiceId },
            });
            if (!existing) {
                throw new NotFoundException(
                    `Invoice item ${itemId} not found on invoice ${invoiceId}`,
                );
            }

            const nextQuantity = dto.quantity ?? existing.quantity;
            const nextSettled = dto.settled ?? existing.settled;
            const settlingNow =
                dto.settled === true && !existing.settled && existing.drugId != null;

            return await this.prisma.$transaction(async (tx) => {
                if (settlingNow) {
                    await this.deductDrugStockFifo(tx, existing.drugId!, nextQuantity);
                }
                const updatedItem = await tx.invoiceItem.update({
                    where: { id: itemId },
                    data: {
                        settled: nextSettled,
                        quantity: nextQuantity,
                        unitPrice:
                            dto.unitPrice !== undefined
                                ? this.asDecimal(dto.unitPrice)
                                : existing.unitPrice,
                    },
                    include: {
                        service: { select: { id: true, name: true, cost: true } },
                        drug: {
                            select: {
                                id: true,
                                genericName: true,
                                brandName: true,
                                strength: true,
                                dosageForm: true,
                            },
                        },
                        createdBy: { select: InvoiceDrugService.invoiceItemCreatedBySelect },
                    },
                });

                if (settlingNow && invoice.encounterId) {
                    await tx.medicationOrder.updateMany({
                        where: {
                            encounterId: invoice.encounterId,
                            drugId: existing.drugId!,
                            patientId: invoice.patientId,
                            status: { not: 'Cancelled' },
                        },
                        data: { status: 'Dispensed' },
                    });
                }

                await this.recalculateInvoiceTotals(invoiceId, tx);
                return updatedItem;
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            const message = error instanceof Error ? error.message : 'Update failed';
            throw new BadRequestException(message);
        }

    }

    async removeDrugInvoiceItem(invoiceId: string, itemId: string) {
        const hasDrugs = await this.hasDrugItems(invoiceId);
        if (!hasDrugs) {
            throw new NotFoundException(`Invoice ${invoiceId} does not contain drug items`);
        }
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
        this.assertInvoiceNotPaid(invoice.status);

        const existing = await this.prisma.invoiceItem.findFirst({
            where: { id: itemId, invoiceId },
        });
        if (!existing) {
            throw new NotFoundException(
                `Invoice item ${itemId} not found on invoice ${invoiceId}`,
            );
        }
        const deleted = await this.prisma.invoiceItem.delete({
            where: { id: itemId },
        });
        await this.recalculateInvoiceTotals(invoiceId);
        return deleted;
    }

    /**
     * Atomically replace the drug on a line by updating the same `InvoiceItem` row
     * (avoids delete-then-create failures and preserves line id, payments, usage segments).
     */
    async substituteDrugInvoiceItem(
        invoiceId: string,
        itemId: string,
        dto: SubstituteDrugInvoiceItemDto,
    ) {
        try {
            const hasDrugs = await this.hasDrugItems(invoiceId);
            if (!hasDrugs) {
                throw new NotFoundException(
                    `Invoice ${invoiceId} does not contain drug items`,
                );
            }

            return await this.prisma.$transaction(async (tx) => {
                const invoice = await tx.invoice.findUnique({
                    where: { id: invoiceId },
                });
                if (!invoice) {
                    throw new NotFoundException(`Invoice ${invoiceId} not found`);
                }
                this.assertInvoiceNotPaid(invoice.status);

                const existing = await tx.invoiceItem.findFirst({
                    where: { id: itemId, invoiceId, drugId: { not: null } },
                });
                if (!existing) {
                    throw new NotFoundException(
                        `Drug invoice item ${itemId} not found on invoice ${invoiceId}`,
                    );
                }
                if (existing.settled) {
                    throw new BadRequestException(
                        'Cannot substitute a settled drug line.',
                    );
                }
                if (existing.drugId === dto.drugId) {
                    throw new BadRequestException(
                        'Replacement drug must differ from the current drug.',
                    );
                }

                const drug = await tx.drug.findUnique({
                    where: { id: dto.drugId },
                });
                if (!drug) {
                    throw new NotFoundException(`Drug ${dto.drugId} not found`);
                }

                const quantity = dto.quantity ?? existing.quantity;
                const unitPrice =
                    dto.unitPrice !== undefined
                        ? this.asDecimal(dto.unitPrice)
                        : existing.unitPrice;

                const updatedItem = await tx.invoiceItem.update({
                    where: { id: itemId },
                    data: {
                        drugId: dto.drugId,
                        serviceId: null,
                        quantity,
                        unitPrice,
                    },
                    include: {
                        service: { select: { id: true, name: true, cost: true } },
                        drug: {
                            select: {
                                id: true,
                                genericName: true,
                                brandName: true,
                                strength: true,
                                dosageForm: true,
                            },
                        },
                        createdBy: { select: InvoiceDrugService.invoiceItemCreatedBySelect },
                    },
                });

                const encounterId = invoice.encounterId;
                const previousDrugId = existing.drugId;
                if (encounterId && previousDrugId) {
                    await tx.medicationOrder.updateMany({
                        where: {
                            encounterId,
                            drugId: previousDrugId,
                        },
                        data: {
                            drugId: dto.drugId,
                            drugName: drug.genericName,
                        },
                    });
                }

                await this.recalculateInvoiceTotals(invoiceId, tx);
                return updatedItem;
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            const message =
                error instanceof Error ? error.message : 'Substitute failed';
            throw new BadRequestException(message);
        }
    }
}