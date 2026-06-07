import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchasesInventoryMovementType,
  PurchasesMovementReferenceType,
  PurchasesStockTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchasesStockTransferDto,
  ListPurchasesStockTransferDto,
  TransferHistoryQueryDto,
} from './dto/stock-transfer.dto';
import { parseDateRange } from '../../common/utils/date-range';

const ALLOWED_SORT = new Set(['createdAt', 'status', 'completedAt']);

@Injectable()
export class PurchasesStockTransferService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchasesStockTransferDto, createdById: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('From and to locations must be different.');
    }
    await this.validateLocations(dto.fromLocationId, dto.toLocationId);
    await this.validateTransferItems(dto.fromLocationId, dto.items);

    const created = await this.prisma.purchasesStockTransfer.create({
      data: {
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        createdById,
        status: PurchasesStockTransferStatus.PENDING,
        items: {
          create: dto.items.map((i) => ({
            batchId: i.batchId,
            quantity: i.quantity,
          })),
        },
      },
      include: this.transferInclude(),
    });

    await this.approve(created.id, createdById);
    return this.complete(created.id, createdById);
  }

  async findAll(query: ListPurchasesStockTransferDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const take = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = Math.max(0, query.skip ?? 0);
    const where: Prisma.PurchasesStockTransferWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (query.status) where.status = query.status;
    if (query.fromLocationId) where.fromLocationId = query.fromLocationId;
    if (query.toLocationId) where.toLocationId = query.toLocationId;
    if (query.itemId) {
      where.items = { some: { batch: { itemId: query.itemId } } };
    }

    const orderBy = ALLOWED_SORT.has(query.sortBy ?? '')
      ? { [query.sortBy!]: query.sortOrder ?? 'desc' }
      : { createdAt: query.sortOrder ?? 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.purchasesStockTransfer.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          fromLocation: {
            select: { id: true, name: true, locationType: true },
          },
          toLocation: {
            select: { id: true, name: true, locationType: true },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchasesStockTransfer.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async history(query: TransferHistoryQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const take = Math.min(Math.max(1, query.take ?? 20), 100);
    const skip = Math.max(0, query.skip ?? 0);
    const where: Prisma.PurchasesStockTransferWhereInput = {
      createdAt: { gte: from, lte: to },
      status:
        query.status ?? PurchasesStockTransferStatus.COMPLETED,
    };
    if (query.itemId) {
      where.items = { some: { batch: { itemId: query.itemId } } };
    }

    const transfers = await this.prisma.purchasesStockTransfer.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      skip,
      take,
      include: {
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            batch: {
              include: { item: { select: { id: true, itemName: true } } },
            },
          },
        },
      },
    });

    return {
      items: transfers.map((t) => ({
        id: t.id,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        fromLocation: t.fromLocation,
        toLocation: t.toLocation,
        requestedByName: t.createdBy
          ? `${t.createdBy.firstName} ${t.createdBy.lastName}`.trim()
          : null,
        item: t.items[0]?.batch?.item ?? null,
        lines: t.items,
      })),
      totalCount: await this.prisma.purchasesStockTransfer.count({ where }),
    };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.purchasesStockTransfer.findUnique({
      where: { id },
      include: this.transferInclude(),
    });
    if (!transfer) {
      throw new NotFoundException(`Stock transfer "${id}" not found.`);
    }
    return transfer;
  }

  async approve(id: string, approvedById: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== PurchasesStockTransferStatus.PENDING) {
      throw new BadRequestException('Only pending transfers can be approved.');
    }
    return this.prisma.purchasesStockTransfer.update({
      where: { id },
      data: {
        status: PurchasesStockTransferStatus.APPROVED,
        approvedById,
      },
      include: this.transferInclude(),
    });
  }

  async complete(id: string, performedById?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== PurchasesStockTransferStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved transfers can be completed.',
      );
    }

    const actorId =
      performedById ?? transfer.approvedById ?? transfer.createdById;

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.items) {
        const batch = await tx.purchaseItemBatch.findUnique({
          where: { id: line.batchId },
        });
        if (!batch || (batch.quantityRemaining ?? 0) < line.quantity) {
          throw new BadRequestException(
            `Insufficient quantity for batch "${line.batchId}" to complete transfer.`,
          );
        }
        await tx.purchaseItemBatch.update({
          where: { id: line.batchId },
          data: {
            quantityRemaining: (batch.quantityRemaining ?? 0) - line.quantity,
          },
        });
        const destBatch = await tx.purchaseItemBatch.create({
          data: {
            itemId: batch.itemId,
            purchaseOrderId: batch.purchaseOrderId,
            supplierId: batch.supplierId,
            batchNumber: batch.batchNumber,
            manufacturingDate: batch.manufacturingDate,
            expiryDate: batch.expiryDate,
            quantityReceived: line.quantity,
            quantityRemaining: line.quantity,
            costPrice: batch.costPrice,
            sellingPrice: batch.sellingPrice,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            grnId: batch.grnId,
          },
        });
        await tx.purchasesInventoryMovement.create({
          data: {
            batchId: line.batchId,
            itemId: batch.itemId,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            movementType: PurchasesInventoryMovementType.TRANSFER_OUT,
            quantity: line.quantity,
            referenceType: PurchasesMovementReferenceType.TRANSFER,
            referenceId: id,
            performedById: actorId,
          },
        });
        await tx.purchasesInventoryMovement.create({
          data: {
            batchId: destBatch.id,
            itemId: batch.itemId,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            movementType: PurchasesInventoryMovementType.TRANSFER_IN,
            quantity: line.quantity,
            referenceType: PurchasesMovementReferenceType.TRANSFER,
            referenceId: id,
            performedById: actorId,
          },
        });
      }
      return tx.purchasesStockTransfer.update({
        where: { id },
        data: {
          status: PurchasesStockTransferStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: this.transferInclude(),
      });
    });
  }

  private transferInclude() {
    return {
      fromLocation: true,
      toLocation: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      items: {
        include: {
          batch: { include: { item: true } },
        },
      },
    };
  }

  private async validateLocations(fromId: string, toId: string) {
    const [fromLoc, toLoc] = await Promise.all([
      this.prisma.purchasesLocation.findUnique({ where: { id: fromId } }),
      this.prisma.purchasesLocation.findUnique({ where: { id: toId } }),
    ]);
    if (!fromLoc) {
      throw new NotFoundException(`From location "${fromId}" not found.`);
    }
    if (!toLoc) {
      throw new NotFoundException(`To location "${toId}" not found.`);
    }
  }

  private async validateTransferItems(
    fromLocationId: string,
    items: CreatePurchasesStockTransferDto['items'],
  ) {
    if (!items?.length) {
      throw new BadRequestException('At least one transfer item is required.');
    }
    for (const item of items) {
      const batch = await this.prisma.purchaseItemBatch.findUnique({
        where: { id: item.batchId },
      });
      if (!batch) {
        throw new NotFoundException(`Batch "${item.batchId}" not found.`);
      }
      if (batch.toLocationId !== fromLocationId) {
        throw new BadRequestException(
          `Batch "${item.batchId}" is not at the selected from-location.`,
        );
      }
      const available = batch.quantityRemaining ?? 0;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Insufficient quantity for batch "${item.batchId}". Available: ${available}.`,
        );
      }
    }
  }
}
