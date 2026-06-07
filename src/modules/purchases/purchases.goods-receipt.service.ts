import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchasesInventoryMovementType,
  PurchasesMovementReferenceType,
  PurchasesOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchasesGoodsReceiptDto } from './dto/goods-receipt.dto';

@Injectable()
export class PurchasesGoodsReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchasesGoodsReceiptDto, receivedById: string) {
    const po = await this.prisma.purchasesPurchaseOrder.findUnique({
      where: { id: dto.purchaseOrderId },
      include: { lines: true },
    });
    if (!po) {
      throw new NotFoundException(
        `Purchase order "${dto.purchaseOrderId}" not found.`,
      );
    }
    if (po.status === PurchasesOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot receive a cancelled purchase order.');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('At least one receipt item is required.');
    }

    const defaultLoc = await this.prisma.purchasesLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultLoc) {
      throw new BadRequestException('No active purchases location found.');
    }
    const toLocationId = dto.toLocationId ?? defaultLoc.id;

    const itemIds = [...new Set(dto.items.map((i) => i.itemId))];
    const purchaseItems = await this.prisma.purchaseItem.findMany({
      where: { id: { in: itemIds }, deletedAt: null },
      select: { id: true, sellingPrice: true },
    });
    const sellingPriceByItemId = new Map(
      purchaseItems.map((i) => [i.id, i.sellingPrice]),
    );
    for (const itemId of itemIds) {
      if (!sellingPriceByItemId.has(itemId)) {
        throw new NotFoundException(`Item "${itemId}" not found.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const gr = await tx.purchasesGoodsReceipt.create({
        data: {
          purchaseOrderId: dto.purchaseOrderId,
          receivedById,
          notes: dto.notes?.trim() ?? null,
        },
      });

      for (const item of dto.items) {
        const costPrice = new Prisma.Decimal(item.costPrice);
        await tx.purchasesGoodsReceiptItem.create({
          data: {
            goodsReceiptId: gr.id,
            itemId: item.itemId,
            batchNumber: item.batchNumber?.trim() ?? null,
            manufacturingDate: item.manufacturingDate
              ? new Date(item.manufacturingDate)
              : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            quantityReceived: item.quantityReceived,
            costPrice,
          },
        });

        const batch = await tx.purchaseItemBatch.create({
          data: {
            itemId: item.itemId,
            purchaseOrderId: po.id,
            supplierId: po.supplierId,
            batchNumber: item.batchNumber?.trim() ?? null,
            manufacturingDate: item.manufacturingDate
              ? new Date(item.manufacturingDate)
              : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            quantityReceived: item.quantityReceived,
            quantityRemaining: item.quantityReceived,
            costPrice,
            sellingPrice: sellingPriceByItemId.get(item.itemId)!,
            fromLocationId: toLocationId,
            toLocationId,
            grnId: gr.id,
          },
        });

        await tx.purchasesInventoryMovement.create({
          data: {
            batchId: batch.id,
            itemId: item.itemId,
            toLocationId,
            movementType: PurchasesInventoryMovementType.PURCHASE,
            quantity: item.quantityReceived,
            referenceType: PurchasesMovementReferenceType.GOODS_RECEIPT,
            referenceId: gr.id,
            performedById: receivedById,
          },
        });
      }

      await tx.purchasesPurchaseOrder.update({
        where: { id: dto.purchaseOrderId },
        data: { status: PurchasesOrderStatus.COMPLETED },
      });

      return tx.purchasesGoodsReceipt.findUnique({
        where: { id: gr.id },
        include: {
          items: { include: { item: true } },
          purchaseOrder: { include: { supplier: true } },
          receivedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          batches: true,
        },
      });
    });
  }

  async findByPurchaseOrderId(purchaseOrderId: string) {
    const receipts = await this.prisma.purchasesGoodsReceipt.findMany({
      where: { purchaseOrderId },
      include: {
        items: { include: { item: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });
    return { data: receipts };
  }

  async findOne(id: string) {
    const gr = await this.prisma.purchasesGoodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: { include: { supplier: true } },
        items: { include: { item: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        batches: { include: { item: true } },
      },
    });
    if (!gr) {
      throw new NotFoundException(`Goods receipt "${id}" not found.`);
    }
    return gr;
  }
}
