import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchasesLocationDto,
  ListPurchasesLocationDto,
  UpdatePurchasesLocationDto,
} from './dto/location.dto';

const ALLOWED_SORT = new Set(['name', 'locationType', 'createdAt']);

@Injectable()
export class PurchasesLocationService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreatePurchasesLocationDto, createdById: string) {
    if (dto.staffId) {
      const existing = await this.prisma.purchasesLocation.findUnique({
        where: { staffId: dto.staffId },
      });
      if (existing) {
        throw new ConflictException(
          `Staff is already assigned to location "${existing.name}".`,
        );
      }
    }
    return this.prisma.purchasesLocation.create({
      data: {
        name: dto.name.trim(),
        locationType: dto.locationType,
        description: dto.description?.trim() ?? null,
        isActive: dto.isActive ?? true,
        staffId: dto.staffId ?? null,
        createdById,
        updatedById: createdById,
      },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListPurchasesLocationDto) {
    const {
      search,
      locationType,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;
    console.log('findAll', query);
    const take = Math.min(Math.max(1, limit), 100);

    const where: Prisma.PurchasesLocationWhereInput = {};
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (locationType) where.locationType = locationType;
    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };
    const [data, total] = await Promise.all([
      this.prisma.purchasesLocation.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.purchasesLocation.count({ where }),
    ]);
    console.log(data, total, skip, take);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const row = await this.prisma.purchasesLocation.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Location "${id}" not found.`);
    }
    return row;
  }

  async update(id: string, dto: UpdatePurchasesLocationDto, updatedById: string) {
    await this.findOne(id);
    if (dto.staffId) {
      const existing = await this.prisma.purchasesLocation.findFirst({
        where: { staffId: dto.staffId, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Staff is already assigned to location "${existing.name}".`,
        );
      }
    }
    return this.prisma.purchasesLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.locationType !== undefined && {
          locationType: dto.locationType,
        }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.staffId !== undefined && { staffId: dto.staffId ?? null }),
        updatedById,
      },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    const batches = await this.prisma.purchaseItemBatch.count({
      where: {
        OR: [{ fromLocationId: id }, { toLocationId: id }],
      },
    });
    if (batches > 0) {
      throw new BadRequestException(
        'Cannot delete location with linked batches.',
      );
    }
    return this.prisma.purchasesLocation.delete({ where: { id } });
  }

  async getItemQuantityByLocation(itemId: string, locationId?: string) {
    const item = await this.prisma.purchaseItem.findFirst({
      where: { id: itemId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException(`Item "${itemId}" not found.`);
    }
    const batches = await this.prisma.purchaseItemBatch.groupBy({
      by: ['toLocationId'],
      where: {
        itemId,
        toLocationId: locationId ? locationId : { not: null },
        quantityRemaining: { gt: 0 },
      },
      _sum: { quantityRemaining: true },
    });
    const locationIds = batches
      .map((b) => b.toLocationId)
      .filter((id): id is string => !!id);
    const locations = await this.prisma.purchasesLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(locations.map((l) => [l.id, l.name]));
    return batches.map((b) => ({
      locationName: nameById.get(b.toLocationId!) ?? 'Unknown',
      quantity: b._sum.quantityRemaining ?? 0,
    }));
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
