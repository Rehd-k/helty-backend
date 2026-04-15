import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePharmacyLocationDto,
  UpdatePharmacyLocationDto,
} from './dto/pharmacy-location.dto';
import { ListPharmacyLocationDto } from './dto/list-pharmacy-location.dto';
import {
  getExcludedStockLocationIds,
  startOfToday,
} from './pharmacy-sellable-stock.util';

const ALLOWED_SORT = new Set(['name', 'locationType', 'createdAt']);

@Injectable()
export class PharmacyLocationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePharmacyLocationDto, createdById: string) {
    if (dto.staffId) {
      const existing = await this.prisma.pharmacyLocation.findUnique({
        where: { staffId: dto.staffId },
      });
      if (existing) {
        throw new ConflictException(
          `Staff is already assigned to location "${existing.name}".`,
        );
      }
    }
    try {
      return await this.prisma.pharmacyLocation.create({
        data: {
          name: dto.name.trim(),
          locationType: dto.locationType,
          description: dto.description?.trim() ?? null,
          staffId: dto.staffId ?? null,
          createdById,
          updatedById: createdById,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A location with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid pharmacy location data.');
    }
  }

  async findAll(query: ListPharmacyLocationDto) {
    const {
      search,
      locationType,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.PharmacyLocationWhereInput = {};

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
      this.prisma.pharmacyLocation.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.pharmacyLocation.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!location) {
      throw new NotFoundException(`Pharmacy location "${id}" not found.`);
    }
    return location;
  }

  async getDrugQuantityByLocation(drugId: string) {
    const drug = await this.prisma.drug.findFirst({
      where: { id: drugId, deletedAt: null },
      select: { id: true },
    });
    if (!drug) {
      throw new NotFoundException(`Drug "${drugId}" not found.`);
    }

    const [excludedLocationIds, startOfDay] = await Promise.all([
      getExcludedStockLocationIds(this.prisma),
      Promise.resolve(startOfToday()),
    ]);
    const excludedSet = new Set(excludedLocationIds);

    const locations = await this.prisma.pharmacyLocation.findMany({
      select: {
        id: true,
        name: true,
        drugBatchesTo: {
          where: {
            drugId,
            quantityRemaining: { gt: 0 },
            expiryDate: { gte: startOfDay },
          },
          select: { quantityRemaining: true },
        },
      },
    });

    return locations
      .filter((location) => !excludedSet.has(location.id))
      .map((location) => {
        const quantity = location.drugBatchesTo.reduce(
          (sum, batch) => sum + (batch.quantityRemaining ?? 0),
          0,
        );
        return {
          locationName: location.name,
          quantity,
        };
      })
      .filter((item) => item.quantity > 0);
  }

  async update(
    id: string,
    dto: UpdatePharmacyLocationDto,
    updatedById: string,
  ) {
    const location = await this.findOne(id);
    if (dto.staffId !== undefined && dto.staffId !== null) {
      const existing = await this.prisma.pharmacyLocation.findFirst({
        where: { staffId: dto.staffId, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(
          `Staff is already assigned to location "${existing.name}".`,
        );
      }
    }
    try {
      return await this.prisma.pharmacyLocation.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.locationType !== undefined && {
            locationType: dto.locationType,
          }),
          ...(dto.description !== undefined && {
            description: dto.description?.trim() ?? null,
          }),
          ...(dto.staffId !== undefined && { staffId: dto.staffId }),
          updatedById,
        },
        include: {
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A location with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid pharmacy location data.');
    }
  }

  async remove(id: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            drugBatchesFrom: true,
            drugBatchesTo: true,
            stockTransfersFrom: true,
            stockTransfersTo: true,
            dispensations: true,
            consumableBatches: true,
            consumableMovements: true,
          },
        },
      },
    });
    if (!location) {
      throw new NotFoundException(`Pharmacy location "${id}" not found.`);
    }
    const total =
      location._count.drugBatchesFrom +
      location._count.drugBatchesTo +
      location._count.stockTransfersFrom +
      location._count.stockTransfersTo +
      location._count.dispensations +
      location._count.consumableBatches +
      location._count.consumableMovements;
    if (total > 0) {
      throw new BadRequestException(
        'Cannot delete location with linked batches, transfers, or dispensations. Reassign or remove them first.',
      );
    }
    return this.prisma.pharmacyLocation.delete({ where: { id } });
  }
}
