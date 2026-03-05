import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoodsReceiptDto } from './dto/goods-receipt.dto';

@Injectable()
export class PharmacyGoodsReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGoodsReceiptDto, receivedById: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.purchaseOrderId },
      include: { items: true },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order "${dto.purchaseOrderId}" not found.`);
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('Cannot receive a cancelled purchase order.');
    }

    const toLocation = await this.prisma.pharmacyLocation.findUnique({
      where: { id: dto.toLocationId },
    });
    if (!toLocation) {
      throw new NotFoundException(`Location "${dto.toLocationId}" not found.`);
    }
    const fromLocationId = dto.fromLocationId ?? dto.toLocationId;
    const fromLocation = await this.prisma.pharmacyLocation.findUnique({
      where: { id: fromLocationId },
    });
    if (!fromLocation) {
      throw new NotFoundException(`From location "${fromLocationId}" not found.`);
    }

    if (!dto.items?.length) {
      throw new BadRequestException('At least one receipt item is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: dto.purchaseOrderId,
          receivedById,
        },
      });

      const grItems = dto.items.map((item) => ({
        goodsReceiptId: gr.id,
        drugId: item.drugId,
        batchNumber: item.batchNumber,
        manufacturingDate: new Date(item.manufacturingDate),
        expiryDate: new Date(item.expiryDate),
        quantityReceived: item.quantityReceived,
        costPrice: new Prisma.Decimal(item.costPrice),
      }));

      await tx.goodsReceiptItem.createMany({ data: grItems });

      for (const item of dto.items) {
        await tx.drugBatch.create({
          data: {
            drugId: item.drugId,
            fromLocationId,
            toLocationId: dto.toLocationId,
            batchNumber: item.batchNumber,
            manufacturingDate: new Date(item.manufacturingDate),
            expiryDate: new Date(item.expiryDate),
            supplierId: po.supplierId,
            costPrice: new Prisma.Decimal(item.costPrice),
            sellingPrice: new Prisma.Decimal(item.sellingPrice),
            quantityReceived: item.quantityReceived,
            quantityRemaining: item.quantityReceived,
            grnId: gr.id,
          },
        });
      }

      await tx.purchaseOrder.update({
        where: { id: dto.purchaseOrderId },
        data: { status: 'RECEIVED' },
      });

      return tx.goodsReceipt.findUnique({
        where: { id: gr.id },
        include: {
          items: { include: { drug: true } },
          purchaseOrder: true,
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async findByPurchaseOrderId(purchaseOrderId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order "${purchaseOrderId}" not found.`);
    }
    const receipts = await this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId },
      include: {
        items: { include: { drug: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });
    return { data: receipts };
  }

  async findOne(id: string) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: { include: { supplier: true } },
        items: { include: { drug: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        batches: { include: { drug: true, fromLocation: true, toLocation: true } },
      },
    });
    if (!gr) {
      throw new NotFoundException(`Goods receipt "${id}" not found.`);
    }
    return gr;
  }
}
