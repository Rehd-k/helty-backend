import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PurchaseNoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreService } from '../store/store.service';
import { CreatePurchaseNoteDto } from './dto/create-purchase-note.dto';
import { ListPurchaseNotesQueryDto } from './dto/list-purchase-notes-query.dto';
import { parseDateRange } from '../../common/utils/date-range';

const ALLOWED_SORT = new Set([
  'createdAt',
  'neededByDate',
  'totalEstimatedCost',
  'status',
]);

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeService: StoreService,
  ) {}

  async create(dto: CreatePurchaseNoteDto, requestedById: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.requestingDepartmentId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department "${dto.requestingDepartmentId}" not found.`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: requestedById },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${requestedById}" not found.`);
    }

    if (!dto.items?.length) {
      throw new BadRequestException('At least one item is required.');
    }

    let totalEstimatedCost = new Prisma.Decimal(0);
    const itemData = await Promise.all(
      dto.items.map(async (item) => {
        const qty = new Prisma.Decimal(item.quantity);
        const unitCost =
          item.estimatedUnitCost != null
            ? new Prisma.Decimal(item.estimatedUnitCost)
            : new Prisma.Decimal(0);
        const lineTotal = unitCost.mul(qty);
        totalEstimatedCost = totalEstimatedCost.add(lineTotal);
        return {
          storeItemId: item.storeItemId ?? null,
          description: item.description,
          quantity: qty,
          estimatedUnitCost: item.estimatedUnitCost != null ? unitCost : null,
          totalEstimatedCost: lineTotal,
          priority: item.priority ?? 'NORMAL',
        };
      }),
    );

    return this.prisma.purchaseNote.create({
      data: {
        requestingDepartmentId: dto.requestingDepartmentId,
        requestedById,
        status: PurchaseNoteStatus.PENDING,
        remarks: dto.remarks,
        neededByDate: dto.neededByDate ? new Date(dto.neededByDate) : null,
        totalEstimatedCost,
        items: {
          create: itemData,
        },
      },
      include: {
        requestingDepartment: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            storeItem: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });
  }

  async findAll(query: ListPurchaseNotesQueryDto) {
    const {
      status,
      departmentId,
      priority,
      fromDate,
      toDate,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;

    const where: Prisma.PurchaseNoteWhereInput = {};
    if (status) where.status = status;
    if (departmentId) where.requestingDepartmentId = departmentId;

    if (fromDate && toDate) {
      const { from, to } = parseDateRange(fromDate, toDate);
      where.createdAt = { gte: from, lte: to };
    }

    if (priority) {
      where.items = { some: { priority } };
    }

    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };

    const take = Math.min(Math.max(1, limit), 100);

    const [data, total] = await Promise.all([
      this.prisma.purchaseNote.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          requestingDepartment: { select: { id: true, name: true } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseNote.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const note = await this.prisma.purchaseNote.findUnique({
      where: { id },
      include: {
        requestingDepartment: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            storeItem: {
              select: { id: true, name: true, sku: true, unitOfMeasure: true },
            },
          },
        },
      },
    });
    if (!note) {
      throw new NotFoundException(`Purchase note "${id}" not found.`);
    }
    return note;
  }

  async updateStatus(
    id: string,
    status: PurchaseNoteStatus,
    options?: { toLocationId?: string; updatedById?: string },
  ) {
    const note = await this.findOne(id);

    if (note.status === PurchaseNoteStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot change status of a completed purchase note.',
      );
    }
    if (note.status === PurchaseNoteStatus.REJECTED) {
      throw new BadRequestException(
        'Cannot change status of a rejected purchase note.',
      );
    }

    const updated = await this.prisma.purchaseNote.update({
      where: { id },
      data: { status },
      include: {
        requestingDepartment: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            storeItem: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (
      status === PurchaseNoteStatus.COMPLETED &&
      options?.toLocationId &&
      options?.updatedById
    ) {
      await this.storeService.recordReceiptFromPurchaseNote(
        id,
        options.toLocationId,
        options.updatedById,
      );
    }

    return updated;
  }
}
