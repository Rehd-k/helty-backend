import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchasesInventoryMovementType, PurchasesMovementReferenceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CorrectBatchQuantityDto,
  CreatePurchaseItemBatchDto,
  SearchPurchaseItemBatchDto,
  UpdatePurchaseItemBatchDto,
} from './dto/batch.dto';
import { parseDateRange } from '../../common/utils/date-range';

const BATCH_QUANTITY_CORRECTION_MIN_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PurchasesBatchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseItemBatchDto, performedById: string) {
    const item = await this.prisma.purchaseItem.findFirst({
      where: { id: dto.itemId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException(`Item "${dto.itemId}" not found.`);
    }
    const quantityRemaining = dto.quantityRemaining ?? dto.quantityReceived;
    if (quantityRemaining > dto.quantityReceived) {
      throw new BadRequestException(
        'quantityRemaining cannot exceed quantityReceived.',
      );
    }
    const defaultLoc = await this.getDefaultLocationId();
    const fromLocationId = dto.fromLocationId ?? defaultLoc;
    const toLocationId = dto.toLocationId ?? defaultLoc;

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.purchaseItemBatch.create({
        data: {
          itemId: dto.itemId,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          supplierId: dto.supplierId ?? null,
          batchNumber: dto.batchNumber?.trim() ?? null,
          manufacturingDate: dto.manufacturingDate
            ? new Date(dto.manufacturingDate)
            : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          quantityReceived: dto.quantityReceived,
          quantityRemaining,
          costPrice:
            dto.costPrice != null
              ? new Prisma.Decimal(dto.costPrice)
              : null,
          sellingPrice:
            dto.sellingPrice != null
              ? new Prisma.Decimal(dto.sellingPrice)
              : item.sellingPrice,
          fromLocationId,
          toLocationId,
          grnId: dto.grnId ?? null,
        },
        include: { item: true, supplier: true, fromLocation: true, toLocation: true },
      });
      await tx.purchasesInventoryMovement.create({
        data: {
          batchId: batch.id,
          itemId: dto.itemId,
          fromLocationId,
          toLocationId,
          movementType: PurchasesInventoryMovementType.PURCHASE,
          quantity: dto.quantityReceived,
          referenceType: PurchasesMovementReferenceType.ADJUSTMENT,
          referenceId: batch.id,
          performedById,
        },
      });
      return batch;
    });
  }

  async search(query: SearchPurchaseItemBatchDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const take = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = Math.max(0, query.skip ?? 0);
    const where: Prisma.PurchaseItemBatchWhereInput = {
      // createdAt: { gte: from, lte: to },
    };
    if (query.itemId) where.itemId = query.itemId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.toLocationId) where.toLocationId = query.toLocationId;

    const [items, totalCount] = await Promise.all([
      this.prisma.purchaseItemBatch.findMany({
        where,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take,
        include: {
          item: true,
          supplier: true,
          fromLocation: true,
          toLocation: true,
        },
      }),
      this.prisma.purchaseItemBatch.count({ where }),
    ]);
    return { items, totalCount };
  }

  async findOne(id: string) {
    const batch = await this.prisma.purchaseItemBatch.findUnique({
      where: { id },
      include: {
        item: true,
        supplier: true,
        fromLocation: true,
        toLocation: true,
      },
    });
    if (!batch) {
      throw new NotFoundException(`Batch "${id}" not found.`);
    }
    return batch;
  }

  async update(id: string, dto: UpdatePurchaseItemBatchDto) {
    await this.findOne(id);
    return this.prisma.purchaseItemBatch.update({
      where: { id },
      data: {
        ...(dto.batchNumber !== undefined && {
          batchNumber: dto.batchNumber?.trim() ?? null,
        }),
        ...(dto.manufacturingDate !== undefined && {
          manufacturingDate: dto.manufacturingDate
            ? new Date(dto.manufacturingDate)
            : null,
        }),
        ...(dto.expiryDate !== undefined && {
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        }),
        ...(dto.quantityReceived !== undefined && {
          quantityReceived: dto.quantityReceived,
        }),
        ...(dto.quantityRemaining !== undefined && {
          quantityRemaining: dto.quantityRemaining,
        }),
        ...(dto.costPrice !== undefined && {
          costPrice:
            dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : null,
        }),
        ...(dto.sellingPrice !== undefined && {
          sellingPrice:
            dto.sellingPrice != null
              ? new Prisma.Decimal(dto.sellingPrice)
              : null,
        }),
      },
      include: { item: true },
    });
  }

  async correctQuantity(
    id: string,
    dto: CorrectBatchQuantityDto,
    staffRole?: string,
  ) {
    if (
      staffRole !== 'PURCHASES_HEAD' &&
      staffRole !== 'SUPER_ADMIN' &&
      staffRole !== 'CMD'
    ) {
      throw new ForbiddenException(
        'Only purchases head can correct batch quantities.',
      );
    }
    const batch = await this.findOne(id);
    const age = Date.now() - batch.createdAt.getTime();
    if (age < BATCH_QUANTITY_CORRECTION_MIN_AGE_MS) {
      throw new BadRequestException(
        'Quantity correction is allowed only at least 24 hours after the batch was created.',
      );
    }
    if (dto.quantityRemaining > dto.quantityReceived) {
      throw new BadRequestException(
        'quantityRemaining cannot exceed quantityReceived.',
      );
    }
    return this.prisma.purchaseItemBatch.update({
      where: { id },
      data: {
        quantityReceived: dto.quantityReceived,
        quantityRemaining: dto.quantityRemaining,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const movements = await this.prisma.purchasesInventoryMovement.count({
      where: { batchId: id },
    });
    if (movements > 1) {
      throw new BadRequestException(
        'Cannot delete batch with inventory movement history.',
      );
    }
    return this.prisma.purchaseItemBatch.delete({ where: { id } });
  }

  private async getDefaultLocationId(): Promise<string> {
    const loc = await this.prisma.purchasesLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!loc) {
      throw new BadRequestException(
        'No purchases location configured. Create a location first.',
      );
    }
    return loc.id;
  }
}
