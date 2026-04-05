import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoreStockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreItemCategoryDto } from './dto/create-store-item-category.dto';
import { UpdateStoreItemCategoryDto } from './dto/update-store-item-category.dto';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { CreateStoreLocationDto } from './dto/create-store-location.dto';
import { IssueItemsDto } from './dto/issue-items.dto';
import { ReceiveItemsDto } from './dto/receive-items.dto';
import { TransferItemsDto } from './dto/transfer-items.dto';
import { StoreAnalyticsQueryDto } from './dto/store-analytics-query.dto';
import {
  ListStoreItemsQueryDto,
  ListStoreStockQueryDto,
} from './dto/list-store-query.dto';
import { UpdateStoreLocationDto } from './dto/update-store-location.dto';
import {
  startOfDay,
  endOfDay,
  parseDateRange,
} from '../../common/utils/date-range';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ─────────────────────────────────────────────────────────
  async createCategory(dto: CreateStoreItemCategoryDto) {
    return this.prisma.storeItemCategory.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateStoreItemCategoryDto) {
    await this.findOneCategory(id);
    return this.prisma.storeItemCategory.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.code != null && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async findAllCategories(isActive?: boolean) {
    const where: Prisma.StoreItemCategoryWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    const categories = await this.prisma.storeItemCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return categories;
  }

  async findOneCategory(id: string) {
    const cat = await this.prisma.storeItemCategory.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!cat) throw new NotFoundException(`Category "${id}" not found.`);
    return cat;
  }

  // ─── Items ───────────────────────────────────────────────────────────────
  async createItem(dto: CreateStoreItemDto) {
    const category = await this.prisma.storeItemCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category)
      throw new NotFoundException(`Category "${dto.categoryId}" not found.`);
    return this.prisma.storeItem.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        categoryId: dto.categoryId,
        unitOfMeasure: dto.unitOfMeasure,
        reorderLevel: new Prisma.Decimal(dto.reorderLevel ?? 0),
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async updateItem(id: string, dto: UpdateStoreItemDto) {
    await this.findOneItem(id);
    return this.prisma.storeItem.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.categoryId != null && { categoryId: dto.categoryId }),
        ...(dto.unitOfMeasure != null && { unitOfMeasure: dto.unitOfMeasure }),
        ...(dto.reorderLevel !== undefined && {
          reorderLevel: new Prisma.Decimal(dto.reorderLevel),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async findAllItems(query: ListStoreItemsQueryDto) {
    const { categoryId, isActive, limit = 20, skip = 0 } = query;
    const where: Prisma.StoreItemWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    const take = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      this.prisma.storeItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: Math.max(0, skip),
        take,
        include: { category: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.storeItem.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOneItem(id: string) {
    const item = await this.prisma.storeItem.findUnique({
      where: { id },
      include: { category: true, stocks: { include: { location: true } } },
    });
    if (!item) throw new NotFoundException(`Store item "${id}" not found.`);
    return item;
  }

  // ─── Locations ────────────────────────────────────────────────────────────
  async createLocation(dto: CreateStoreLocationDto) {
    return this.prisma.storeLocation.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        isPrimary: dto.isPrimary ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateLocation(id: string, dto: UpdateStoreLocationDto) {
    await this.findOneLocation(id);
    return this.prisma.storeLocation.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.code != null && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async findAllLocations(isActive?: boolean) {
    const where: Prisma.StoreLocationWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    const locations = await this.prisma.storeLocation.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return locations;
  }

  async findOneLocation(id: string) {
    const loc = await this.prisma.storeLocation.findUnique({
      where: { id },
      include: { _count: { select: { stocks: true } } },
    });
    if (!loc) throw new NotFoundException(`Store location "${id}" not found.`);
    return loc;
  }

  // ─── Stock ───────────────────────────────────────────────────────────────
  async getStock(query: ListStoreStockQueryDto) {
    const { locationId, itemId, limit = 20, skip = 0 } = query;
    const where: Prisma.StoreStockWhereInput = {};
    if (locationId) where.locationId = locationId;
    if (itemId) where.itemId = itemId;
    const take = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      this.prisma.storeStock.findMany({
        where,
        orderBy: [{ locationId: 'asc' }, { itemId: 'asc' }],
        skip: Math.max(0, skip),
        take,
        include: {
          item: { include: { category: { select: { id: true, name: true } } } },
          location: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.storeStock.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  private async getOrCreateStock(
    itemId: string,
    locationId: string,
  ): Promise<{
    id: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
  }> {
    let stock = await this.prisma.storeStock.findUnique({
      where: { itemId_locationId: { itemId, locationId } },
    });
    if (!stock) {
      stock = await this.prisma.storeStock.create({
        data: {
          itemId,
          locationId,
          quantity: 0,
          unitCost: 0,
        },
      });
    }
    return stock;
  }

  private async ensureSufficientStock(
    itemId: string,
    locationId: string,
    requiredQty: number,
  ) {
    const stock = await this.getOrCreateStock(itemId, locationId);
    const qty = Number(stock.quantity);
    if (qty < requiredQty) {
      throw new BadRequestException(
        `Insufficient stock. Item ${itemId} at location ${locationId}: available ${qty}, required ${requiredQty}.`,
      );
    }
    return stock;
  }

  // ─── Movements: Issue to department ───────────────────────────────────────
  async issueItems(dto: IssueItemsDto, createdById: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!dept)
      throw new NotFoundException(
        `Department "${dto.departmentId}" not found.`,
      );
    await this.findOneLocation(dto.fromLocationId);

    const results: Array<{
      itemId: string;
      quantity: number;
      movementId: string;
    }> = [];
    for (const line of dto.items) {
      await this.findOneItem(line.itemId);
      const stock = await this.ensureSufficientStock(
        line.itemId,
        dto.fromLocationId,
        line.quantity,
      );
      const qtyDec = new Prisma.Decimal(line.quantity);
      const unitCost =
        line.unitCost != null
          ? new Prisma.Decimal(line.unitCost)
          : stock.unitCost;
      const totalCost = unitCost.mul(qtyDec);

      const movement = await this.prisma.storeStockMovement.create({
        data: {
          itemId: line.itemId,
          fromLocationId: dto.fromLocationId,
          toLocationId: null,
          departmentId: dto.departmentId,
          type: StoreStockMovementType.ISSUE,
          quantity: qtyDec,
          unitCost,
          totalCost,
          reason: dto.reason,
          createdById,
        },
      });
      results.push({
        itemId: line.itemId,
        quantity: line.quantity,
        movementId: movement.id,
      });

      const newQty = stock.quantity.sub(qtyDec);
      const newQtyNum = Number(newQty);
      await this.prisma.storeStock.update({
        where: { id: stock.id },
        data: {
          quantity: newQty,
          ...(newQtyNum > 0 ? {} : { unitCost: new Prisma.Decimal(0) }),
          lastMovementAt: new Date(),
        },
      });
    }
    return { issued: results };
  }

  // ─── Movements: Receive (or return from department) ───────────────────────
  async receiveItems(dto: ReceiveItemsDto, createdById: string) {
    await this.findOneLocation(dto.toLocationId);

    const results: Array<{
      itemId: string;
      quantity: number;
      movementId: string;
    }> = [];
    for (const line of dto.items) {
      await this.findOneItem(line.itemId);
      const unitCost = new Prisma.Decimal(line.unitCost);
      const qtyDec = new Prisma.Decimal(line.quantity);
      const totalCost = unitCost.mul(qtyDec);

      const movement = await this.prisma.storeStockMovement.create({
        data: {
          itemId: line.itemId,
          fromLocationId: null,
          toLocationId: dto.toLocationId,
          departmentId: dto.departmentId ?? null,
          type: dto.departmentId
            ? StoreStockMovementType.RETURN
            : StoreStockMovementType.RECEIPT,
          quantity: qtyDec,
          unitCost,
          totalCost,
          reason: dto.reason,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          createdById,
        },
      });
      results.push({
        itemId: line.itemId,
        quantity: line.quantity,
        movementId: movement.id,
      });

      const stock = await this.getOrCreateStock(line.itemId, dto.toLocationId);
      const prevQty = stock.quantity;
      const prevCost = stock.unitCost;
      const newQty = prevQty.add(qtyDec);
      const newCost =
        Number(newQty) === 0
          ? new Prisma.Decimal(0)
          : prevQty.mul(prevCost).add(totalCost).div(newQty);

      await this.prisma.storeStock.update({
        where: { id: stock.id },
        data: {
          quantity: newQty,
          unitCost: newCost,
          lastMovementAt: new Date(),
        },
      });
    }
    return { received: results };
  }

  // ─── Movements: Transfer between locations ────────────────────────────────
  async transferItems(dto: TransferItemsDto, createdById: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('From and to locations must be different.');
    }
    await this.findOneLocation(dto.fromLocationId);
    await this.findOneLocation(dto.toLocationId);

    const results: Array<{
      itemId: string;
      quantity: number;
      movementId: string;
    }> = [];
    for (const line of dto.items) {
      await this.findOneItem(line.itemId);
      const stock = await this.ensureSufficientStock(
        line.itemId,
        dto.fromLocationId,
        line.quantity,
      );
      const qtyDec = new Prisma.Decimal(line.quantity);
      const unitCost = stock.unitCost;
      const totalCost = unitCost.mul(qtyDec);

      const movement = await this.prisma.storeStockMovement.create({
        data: {
          itemId: line.itemId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          departmentId: null,
          type: StoreStockMovementType.TRANSFER,
          quantity: qtyDec,
          unitCost,
          totalCost,
          reason: dto.reason,
          createdById,
        },
      });
      results.push({
        itemId: line.itemId,
        quantity: line.quantity,
        movementId: movement.id,
      });

      const newFromQty = stock.quantity.sub(qtyDec);
      await this.prisma.storeStock.update({
        where: { id: stock.id },
        data: {
          quantity: newFromQty,
          lastMovementAt: new Date(),
        },
      });

      const toStock = await this.getOrCreateStock(
        line.itemId,
        dto.toLocationId,
      );
      const prevQty = toStock.quantity;
      const prevCost = toStock.unitCost;
      const newToQty = prevQty.add(qtyDec);
      const newToCost =
        Number(newToQty) === 0
          ? unitCost
          : prevQty.mul(prevCost).add(totalCost).div(newToQty);

      await this.prisma.storeStock.update({
        where: { id: toStock.id },
        data: {
          quantity: newToQty,
          unitCost: newToCost,
          lastMovementAt: new Date(),
        },
      });
    }
    return { transferred: results };
  }

  // ─── Analytics dashboard ─────────────────────────────────────────────────
  async getAnalyticsDashboard(query: StoreAnalyticsQueryDto) {
    let from: Date;
    let to: Date;
    if (query.fromDate && query.toDate) {
      const range = parseDateRange(query.fromDate, query.toDate);
      from = range.from;
      to = range.to;
    } else {
      to = endOfDay(new Date());
      const d = new Date(to);
      d.setDate(d.getDate() - 30);
      from = startOfDay(d);
    }

    const limit = Math.min(Math.max(1, query.limit ?? 10), 50);
    const movementWhere: Prisma.StoreStockMovementWhereInput = {
      createdAt: { gte: from, lte: to },
      type: StoreStockMovementType.ISSUE,
    };
    if (query.departmentId) movementWhere.departmentId = query.departmentId;

    const categoryWhere: Prisma.StoreItemCategoryWhereInput = {};
    if (query.categoryId) categoryWhere.id = query.categoryId;

    const [
      lowStockItems,
      stockValueByCategory,
      movementsByDepartment,
      topMovingItems,
    ] = await Promise.all([
      this.getLowStockItems(limit, query.categoryId),
      this.getStockValueByCategory(query.categoryId),
      this.getMovementsByDepartment(from, to, query.departmentId),
      this.getTopMovingItems(movementWhere, limit),
    ]);

    return {
      from,
      to,
      lowStockItems,
      stockValueByCategory,
      movementsByDepartment,
      topMovingItems,
    };
  }

  private async getLowStockItems(limit: number, categoryId?: string) {
    const items = await this.prisma.storeItem.findMany({
      where: {
        isActive: true,
        ...(categoryId && { categoryId }),
      },
      include: {
        category: { select: { id: true, name: true } },
        stocks: {
          include: { location: { select: { id: true, name: true } } },
        },
      },
    });
    const withTotal = items.map((item) => {
      const totalQty = item.stocks.reduce(
        (sum, s) => sum + Number(s.quantity),
        0,
      );
      const reorderLevel = Number(item.reorderLevel);
      return {
        ...item,
        totalQuantity: totalQty,
        reorderLevel,
        isLowStock: totalQty < reorderLevel,
      };
    });
    return withTotal
      .filter((x) => x.isLowStock)
      .sort((a, b) => a.totalQuantity - b.totalQuantity)
      .slice(0, limit);
  }

  private async getStockValueByCategory(categoryId?: string) {
    const where: Prisma.StoreStockWhereInput = {};
    if (categoryId) where.item = { categoryId };
    const stocks = await this.prisma.storeStock.findMany({
      where,
      include: { item: { include: { category: true } } },
    });
    const byCategory = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        value: number;
        quantity: number;
      }
    >();
    for (const s of stocks) {
      const qty = Number(s.quantity);
      const cost = Number(s.unitCost);
      const value = qty * cost;
      const cat = s.item.category;
      const key = cat.id;
      const existing = byCategory.get(key);
      if (existing) {
        existing.value += value;
        existing.quantity += qty;
      } else {
        byCategory.set(key, {
          categoryId: cat.id,
          categoryName: cat.name,
          value,
          quantity: qty,
        });
      }
    }
    return Array.from(byCategory.values());
  }

  private async getMovementsByDepartment(
    from: Date,
    to: Date,
    departmentId?: string,
  ) {
    const where: Prisma.StoreStockMovementWhereInput = {
      createdAt: { gte: from, lte: to },
      type: StoreStockMovementType.ISSUE,
      departmentId: { not: null },
    };
    if (departmentId) where.departmentId = departmentId;

    const movements = await this.prisma.storeStockMovement.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    const byDept = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        count: number;
        totalQuantity: number;
        totalCost: number;
      }
    >();
    for (const m of movements) {
      if (!m.departmentId || !m.department) continue;
      const key = m.departmentId;
      const qty = Number(m.quantity);
      const cost = Number(m.totalCost);
      const existing = byDept.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalQuantity += qty;
        existing.totalCost += cost;
      } else {
        byDept.set(key, {
          departmentId: m.departmentId,
          departmentName: m.department.name,
          count: 1,
          totalQuantity: qty,
          totalCost: cost,
        });
      }
    }
    return Array.from(byDept.values());
  }

  private async getTopMovingItems(
    movementWhere: Prisma.StoreStockMovementWhereInput,
    limit: number,
  ) {
    const movements = await this.prisma.storeStockMovement.findMany({
      where: movementWhere,
      include: { item: { include: { category: { select: { name: true } } } } },
    });
    const byItem = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        categoryName: string;
        totalQuantity: number;
        movementCount: number;
      }
    >();
    for (const m of movements) {
      const key = m.itemId;
      const qty = Number(m.quantity);
      const existing = byItem.get(key);
      if (existing) {
        existing.totalQuantity += qty;
        existing.movementCount += 1;
      } else {
        byItem.set(key, {
          itemId: m.item.id,
          itemName: m.item.name,
          categoryName: m.item.category?.name ?? '',
          totalQuantity: qty,
          movementCount: 1,
        });
      }
    }
    return Array.from(byItem.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  /** Called by purchases module when a purchase note is completed: record receipts into store. */
  async recordReceiptFromPurchaseNote(
    purchaseNoteId: string,
    toLocationId: string,
    createdById: string,
  ) {
    const note = await this.prisma.purchaseNote.findUnique({
      where: { id: purchaseNoteId },
      include: {
        items: {
          where: { storeItemId: { not: null } },
          include: { storeItem: true },
        },
      },
    });
    if (!note)
      throw new NotFoundException(
        `Purchase note "${purchaseNoteId}" not found.`,
      );
    if (note.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Can only record receipt for a completed purchase note.',
      );
    }

    const lines = note.items
      .filter((i) => i.storeItemId != null && i.quantity != null)
      .map((i) => ({
        itemId: i.storeItemId!,
        quantity: Number(i.quantity),
        unitCost: Number(i.estimatedUnitCost ?? 0),
      }));
    if (lines.length === 0) {
      return { received: [] };
    }

    return this.receiveItems(
      {
        toLocationId,
        items: lines,
        referenceType: 'PURCHASE_NOTE',
        referenceId: purchaseNoteId,
      },
      createdById,
    );
  }
}
