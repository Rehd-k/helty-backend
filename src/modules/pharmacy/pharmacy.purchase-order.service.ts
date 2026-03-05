import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/purchase-order.dto';
import { ListPurchaseOrderDto } from './dto/list-purchase-order.dto';

const ALLOWED_SORT = new Set(['createdAt', 'totalAmount', 'status']);

@Injectable()
export class PharmacyPurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseOrderDto, createdById: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${dto.supplierId}" not found.`);
    }
    if (supplier.isBlacklisted) {
      throw new BadRequestException('Cannot create PO for a blacklisted supplier.');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('At least one item is required.');
    }

    let totalAmount = new Prisma.Decimal(0);
    const itemData = await Promise.all(
      dto.items.map(async (item) => {
        const drug = await this.prisma.drug.findFirst({
          where: { id: item.drugId, deletedAt: null },
        });
        if (!drug) {
          throw new NotFoundException(`Drug "${item.drugId}" not found.`);
        }
        const price = new Prisma.Decimal(item.unitPrice);
        const qty = item.quantity;
        totalAmount = totalAmount.add(price.mul(qty));
        return {
          drugId: item.drugId,
          quantity: qty,
          unitPrice: price,
          expectedExpiry: item.expectedExpiry ? new Date(item.expectedExpiry) : null,
        };
      }),
    );

    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: dto.supplierId,
        totalAmount,
        createdById,
        items: {
          create: itemData,
        },
      },
      include: {
        supplier: true,
        items: { include: { drug: { select: { id: true, genericName: true, brandName: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListPurchaseOrderDto) {
    const { status, supplierId, sortBy, sortOrder = 'desc', skip = 0, limit = 20 } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.PurchaseOrderWhereInput = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true, receipts: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { drug: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        receipts: true,
      },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order "${id}" not found.`);
    }
    return po;
  }

  async updateStatus(id: string, status: PurchaseOrderStatus, approvedById?: string) {
    const po = await this.findOne(id);
    if (po.status === 'RECEIVED') {
      throw new BadRequestException('Cannot change status of a received PO.');
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('Cannot change status of a cancelled PO.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPROVED' && approvedById && { approvedById }),
      },
      include: {
        supplier: true,
        items: { include: { drug: true } },
      },
    });
  }
}
