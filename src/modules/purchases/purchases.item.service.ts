import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchaseItemDto,
  SearchPurchaseItemDto,
  UpdatePurchaseItemDto,
} from './dto/item.dto';
import { resolvePagination } from './purchases.util';

const ALLOWED_SORT = new Set(['itemName', 'createdAt', 'reorderLevel']);

@Injectable()
export class PurchasesItemService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseItemDto, createdById: string) {
    if (!dto.itemName?.trim()) {
      throw new BadRequestException('Item name is required');
    }
    return this.prisma.purchaseItem.create({
      data: {
        itemName: dto.itemName.trim(),
        sku: dto.sku?.trim() ?? null,
        category: dto.category?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        manufacturerId: dto.manufacturerId ?? null,
        unitOfMeasure: dto.unitOfMeasure?.trim() ?? null,
        reorderLevel: dto.reorderLevel ?? 0,
        reorderQuantity: dto.reorderQuantity ?? 0,
        sellingPrice: new Prisma.Decimal(dto.sellingPrice ?? 0),
        createdById,
        updatedById: createdById,
      },
      include: { manufacturer: true },
    });
  }

  async search(query: SearchPurchaseItemDto) {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const where: Prisma.PurchaseItemWhereInput = { deletedAt: null };
    const term = (query.search ?? query.itemName)?.trim();
    if (term) {
      where.OR = [
        { itemName: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (query.manufacturerId) where.manufacturerId = query.manufacturerId;
    if (query.supplierId) {
      where.batches = { some: { supplierId: query.supplierId } };
    }
    const orderBy = ALLOWED_SORT.has(query.sortBy ?? '')
      ? { [query.sortBy!]: query.sortOrder ?? 'desc' }
      : { createdAt: query.sortOrder ?? 'desc' };

    let data = await this.prisma.purchaseItem.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        manufacturer: true,
        batches: {
          select: {
            quantityRemaining: true,
            expiryDate: true,
          },
        },
      },
    });
    const total = await this.prisma.purchaseItem.count({ where });

    if (query.inStock === 'true' || query.lowStock === 'true' || query.expiringSoon === 'true') {
      const now = new Date();
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 90);
      data = data.filter((item) => {
        const qty = item.batches.reduce(
          (s, b) => s + (b.quantityRemaining ?? 0),
          0,
        );
        const nearExpiry = item.batches.some(
          (b) => b.expiryDate && b.expiryDate <= soon && b.expiryDate >= now,
        );
        if (query.inStock === 'true' && qty <= 0) return false;
        if (query.lowStock === 'true' && qty > item.reorderLevel) return false;
        if (query.expiringSoon === 'true' && !nearExpiry) return false;
        return true;
      });
    }

    const enriched = data.map((item) => {
      const stockRemaining = item.batches.reduce(
        (s, b) => s + (b.quantityRemaining ?? 0),
        0,
      );
      const { batches: _b, ...rest } = item;
      return { ...rest, stockRemaining };
    });

    return { data: enriched, total, page, pageSize };
  }

  async findOne(id: string) {
    const item = await this.prisma.purchaseItem.findFirst({
      where: { id, deletedAt: null },
      include: {
        manufacturer: true,
        batches: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!item) {
      throw new NotFoundException(`Item "${id}" not found.`);
    }
    const stockRemaining = item.batches.reduce(
      (s, b) => s + (b.quantityRemaining ?? 0),
      0,
    );
    return { ...item, stockRemaining };
  }

  async update(id: string, dto: UpdatePurchaseItemDto, updatedById: string) {
    await this.findOne(id);
    return this.prisma.purchaseItem.update({
      where: { id },
      data: {
        ...(dto.itemName !== undefined && { itemName: dto.itemName.trim() }),
        ...(dto.sku !== undefined && { sku: dto.sku?.trim() ?? null }),
        ...(dto.category !== undefined && {
          category: dto.category?.trim() ?? null,
        }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
        ...(dto.manufacturerId !== undefined && {
          manufacturerId: dto.manufacturerId,
        }),
        ...(dto.unitOfMeasure !== undefined && {
          unitOfMeasure: dto.unitOfMeasure?.trim() ?? null,
        }),
        ...(dto.reorderLevel !== undefined && {
          reorderLevel: dto.reorderLevel,
        }),
        ...(dto.reorderQuantity !== undefined && {
          reorderQuantity: dto.reorderQuantity,
        }),
        ...(dto.sellingPrice !== undefined && {
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
        }),
        updatedById,
      },
      include: { manufacturer: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.purchaseItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
