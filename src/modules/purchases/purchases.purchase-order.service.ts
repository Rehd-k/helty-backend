import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchasesOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchasesPurchaseOrderDto,
  ListPurchasesPurchaseOrderDto,
} from './dto/purchase-order.dto';
import { parseDateRange } from '../../common/utils/date-range';

const ALLOWED_SORT = new Set(['createdAt', 'totalAmount', 'status']);

@Injectable()
export class PurchasesPurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchasesPurchaseOrderDto, createdById: string) {
    const supplier = await this.prisma.purchasesSupplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${dto.supplierId}" not found.`);
    }
    if (supplier.isBlacklisted) {
      throw new BadRequestException('Cannot create PO for blacklisted supplier.');
    }
    let totalAmount = new Prisma.Decimal(0);
    const lines = await Promise.all(
      dto.lines.map(async (line) => {
        const item = await this.prisma.purchaseItem.findFirst({
          where: { id: line.itemId, deletedAt: null },
        });
        if (!item) {
          throw new NotFoundException(`Item "${line.itemId}" not found.`);
        }
        const unitCost = new Prisma.Decimal(line.unitCost);
        const lineTotal = unitCost.mul(line.quantity);
        totalAmount = totalAmount.add(lineTotal);
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          unitCost,
          lineTotal,
          externalItemName: line.externalItemName?.trim() ?? null,
        };
      }),
    );

    return this.prisma.purchasesPurchaseOrder.create({
      data: {
        supplierId: dto.supplierId,
        totalAmount,
        createdById,
        lines: { create: lines },
      },
      include: {
        supplier: true,
        lines: { include: { item: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListPurchasesPurchaseOrderDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const take = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = Math.max(0, query.skip ?? 0);
    const where: Prisma.PurchasesPurchaseOrderWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    const orderBy = ALLOWED_SORT.has(query.sortBy ?? '')
      ? { [query.sortBy!]: query.sortOrder ?? 'desc' }
      : { createdAt: query.sortOrder ?? 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.purchasesPurchaseOrder.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { lines: true, receipts: true } },
        },
      }),
      this.prisma.purchasesPurchaseOrder.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const po = await this.prisma.purchasesPurchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: { include: { item: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        receipts: true,
        requisition: true,
      },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order "${id}" not found.`);
    }
    return po;
  }

  async updateStatus(
    id: string,
    status: PurchasesOrderStatus,
    staffId: string,
    staffRole?: string,
  ) {
    if (
      status === PurchasesOrderStatus.APPROVED &&
      staffRole !== 'PURCHASES_HEAD' &&
      staffRole !== 'SUPER_ADMIN' &&
      staffRole !== 'CMD'
    ) {
      throw new ForbiddenException(
        'Only purchases head can approve purchase orders.',
      );
    }
    const po = await this.findOne(id);
    if (po.status === PurchasesOrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot change a completed purchase order.');
    }
    if (po.status === PurchasesOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change a cancelled purchase order.');
    }
    return this.prisma.purchasesPurchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(status === PurchasesOrderStatus.APPROVED && {
          approvedById: staffId,
        }),
      },
      include: { supplier: true, lines: true },
    });
  }
}
