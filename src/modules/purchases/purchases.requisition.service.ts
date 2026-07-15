import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RequisitionItemType,
  RequisitionStatus,
  PurchasesOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConvertRequisitionToPoDto,
  CreateRequisitionDto,
  ListRequisitionDto,
  RejectRequisitionDto,
} from './dto/requisition.dto';
import { parseDateRange } from '../../common/utils/date-range';
import {
  findOrCreateExternalRequisitionItem,
  resolvePagination,
} from './purchases.util';

@Injectable()
export class PurchasesRequisitionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRequisitionDto, requestedById: string) {
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one line is required.');
    }
    return this.prisma.requisition.create({
      data: {
        requestingDepartment: dto.requestingDepartment,
        requestedById,
        notes: dto.notes?.trim() ?? null,
        lines: {
          create: dto.lines.map((line) => ({
            itemType: line.itemType,
            itemId: line.itemId,
            itemName: line.itemName.trim(),
            quantity: line.quantity,
            priority: line.priority ?? 'NORMAL',
            notes: line.notes?.trim() ?? null,
            purchaseItemId:
              line.itemType === RequisitionItemType.PURCHASE_ITEM
                ? line.itemId
                : null,
          })),
        },
      },
      include: {
        lines: true,
        requestedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findAll(query: ListRequisitionDto) {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const where: Prisma.RequisitionWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (query.status) where.status = query.status;
    if (query.requestingDepartment) {
      where.requestingDepartment = query.requestingDepartment;
    }
    const [data, total] = await Promise.all([
      this.prisma.requisition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          lines: true,
          requestedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.requisition.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const row = await this.prisma.requisition.findUnique({
      where: { id },
      include: {
        lines: true,
        requestedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        rejectedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        purchaseOrder: { include: { supplier: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Requisition "${id}" not found.`);
    }
    return row;
  }

  async approve(id: string, staffId: string, staffRole?: string) {
    this.assertHead(staffRole);
    const req = await this.findOne(id);
    if (req.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException('Only pending requisitions can be approved.');
    }
    return this.prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.APPROVED,
        approvedById: staffId,
        rejectedById: null,
        rejectReason: null,
      },
      include: { lines: true },
    });
  }

  async reject(
    id: string,
    dto: RejectRequisitionDto,
    staffId: string,
    staffRole?: string,
  ) {
    this.assertHead(staffRole);
    const req = await this.findOne(id);
    if (req.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException('Only pending requisitions can be rejected.');
    }
    return this.prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.REJECTED,
        rejectedById: staffId,
        rejectReason: dto.reason?.trim() ?? null,
      },
      include: { lines: true },
    });
  }

  async convertToPo(
    id: string,
    dto: ConvertRequisitionToPoDto,
    createdById: string,
    staffRole?: string,
  ) {
    this.assertHead(staffRole);
    const req = await this.findOne(id);
    if (req.status !== RequisitionStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved requisitions can be converted to a purchase order.',
      );
    }
    if (req.purchaseOrder) {
      throw new BadRequestException(
        'This requisition already has a linked purchase order.',
      );
    }
    const supplier = await this.prisma.purchasesSupplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${dto.supplierId}" not found.`);
    }
    if (supplier.isBlacklisted) {
      throw new BadRequestException('Cannot use a blacklisted supplier.');
    }

    return this.prisma.$transaction(async (tx) => {
      const placeholder = await findOrCreateExternalRequisitionItem(
        tx,
        createdById,
      );
      let totalAmount = new Prisma.Decimal(0);
      const lineCreates: Prisma.PurchasesPurchaseOrderLineCreateWithoutPurchaseOrderInput[] =
        [];

      for (const line of req.lines) {
        let itemId = placeholder.id;
        let externalItemName: string | null = null;
        if (line.itemType === RequisitionItemType.PURCHASE_ITEM) {
          const item = await tx.purchaseItem.findFirst({
            where: { id: line.itemId, deletedAt: null },
          });
          if (!item) {
            throw new NotFoundException(
              `Purchase item "${line.itemId}" not found for requisition line.`,
            );
          }
          itemId = item.id;
        } else {
          externalItemName = line.itemName;
        }
        const unitCost = new Prisma.Decimal(0);
        const lineTotal = unitCost.mul(line.quantity);
        totalAmount = totalAmount.add(lineTotal);
        lineCreates.push({
          item: { connect: { id: itemId } },
          quantity: line.quantity,
          unitCost,
          lineTotal,
          externalItemName,
        });
      }

      const po = await tx.purchasesPurchaseOrder.create({
        data: {
          supplierId: dto.supplierId,
          status: PurchasesOrderStatus.DRAFT,
          totalAmount,
          createdById,
          requisitionId: id,
          lines: { create: lineCreates },
        },
        include: { lines: true, supplier: true },
      });

      await tx.requisition.update({
        where: { id },
        data: { status: RequisitionStatus.FULFILLED },
      });

      return po;
    });
  }

  private assertHead(staffRole?: string) {
    if (
      staffRole !== 'PURCHASES_HEAD' &&
      staffRole !== 'SUPER_ADMIN' &&
      staffRole !== 'CMD'
    ) {
      throw new ForbiddenException(
        'Only purchases head staff can perform this action.',
      );
    }
  }
}
