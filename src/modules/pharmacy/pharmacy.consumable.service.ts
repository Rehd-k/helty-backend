import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateConsumableBatchDto,
  CreateConsumableDto,
  UpdateConsumableDto,
} from './dto/consumable.dto';
import { ListConsumableDto } from './dto/list-consumable.dto';
import { parseDateRange } from '../../common/utils/date-range';

const ALLOWED_SORT = new Set(['name', 'category', 'createdAt']);

@Injectable()
export class PharmacyConsumableService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConsumableDto) {
    try {
      return await this.prisma.consumable.create({
        data: {
          name: dto.name.trim(),
          category: dto.category?.trim() ?? null,
          reorderLevel: dto.reorderLevel ?? null,
          isBillable: dto.isBillable ?? true,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A consumable with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid consumable data.');
    }
  }

  async findAll(query: ListConsumableDto) {
    const {
      search,
      category,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
      fromDate,
      toDate,
    } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.ConsumableWhereInput = {
      createdAt: { gte: from, lte: to },
    };

    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (category?.trim()) {
      where.category = { contains: category.trim(), mode: 'insensitive' };
    }

    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.consumable.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: { _count: { select: { batches: true } } },
      }),
      this.prisma.consumable.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const consumable = await this.prisma.consumable.findUnique({
      where: { id },
      include: {
        batches: {
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { batches: true, prescriptionItems: true } },
      },
    });
    if (!consumable) {
      throw new NotFoundException(`Consumable "${id}" not found.`);
    }
    return consumable;
  }

  async update(id: string, dto: UpdateConsumableDto) {
    await this.findOne(id);
    try {
      return await this.prisma.consumable.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.category !== undefined && {
            category: dto.category?.trim() ?? null,
          }),
          ...(dto.reorderLevel !== undefined && {
            reorderLevel: dto.reorderLevel,
          }),
          ...(dto.isBillable !== undefined && { isBillable: dto.isBillable }),
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A consumable with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid consumable data.');
    }
  }

  async remove(id: string) {
    const consumable = await this.prisma.consumable.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, prescriptionItems: true } },
      },
    });
    if (!consumable) {
      throw new NotFoundException(`Consumable "${id}" not found.`);
    }
    if (
      consumable._count.batches > 0 ||
      consumable._count.prescriptionItems > 0
    ) {
      throw new BadRequestException(
        'Cannot delete consumable with linked batches or prescription items. Remove them first.',
      );
    }
    return this.prisma.consumable.delete({ where: { id } });
  }

  async createBatch(consumableId: string, dto: CreateConsumableBatchDto) {
    await this.findOne(consumableId);
    return this.prisma.consumableBatch.create({
      data: {
        consumableId,
        locationType: dto.locationType,
        locationId: dto.locationId,
        batchNumber: dto.batchNumber?.trim() || null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        quantityReceived: dto.quantityReceived,
        quantityRemaining: dto.quantityRemaining,
        costPrice: new Prisma.Decimal(dto.costPrice),
        sellingPrice: new Prisma.Decimal(dto.sellingPrice),
      },
    });
  }

  async listBatches(consumableId: string) {
    await this.findOne(consumableId);
    return this.prisma.consumableBatch.findMany({
      where: { consumableId },
      orderBy: { createdAt: 'desc' },
      include: {
        location: { select: { id: true, name: true, locationType: true } },
      },
    });
  }
}
