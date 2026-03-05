import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PharmacyLocationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchBatchDto } from './dto/search-batch.dto';

const ALLOWED_SORT_FIELDS = new Set([
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
  'costPrice',
  'sellingPrice',
  'quantityRemaining',
  'createdAt',
]);

@Injectable()
export class PharmacyBatchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchBatchDto) {
    const {
      drugId,
      batchNumber,
      manufacturingDateFrom,
      manufacturingDateTo,
      expiryDateFrom,
      expiryDateTo,
      supplierId,
      fromLocationId,
      toLocationId,
      locationType,
      inStock,
      limit = 50,
      skip = 0,
      sortBy = 'expiryDate',
      sortOrder = 'asc',
    } = dto;

    const take = Math.min(Math.max(1, Number(limit) || 50), 200);
    const where: Prisma.DrugBatchWhereInput = {};

    if (drugId) where.drugId = drugId;
    if (batchNumber) {
      where.batchNumber = { contains: batchNumber, mode: 'insensitive' };
    }
    if (supplierId) where.supplierId = supplierId;
    if (fromLocationId) where.fromLocationId = fromLocationId;
    if (toLocationId) where.toLocationId = toLocationId;
    if (locationType) {
      const locType = locationType as PharmacyLocationType;
      where.OR = [
        { fromLocation: { locationType: locType } },
        { toLocation: { locationType: locType } },
      ];
    }

    if (manufacturingDateFrom || manufacturingDateTo) {
      where.manufacturingDate = {};
      if (manufacturingDateFrom) {
        (where.manufacturingDate as Prisma.DateTimeFilter).gte = new Date(
          manufacturingDateFrom,
        );
      }
      if (manufacturingDateTo) {
        (where.manufacturingDate as Prisma.DateTimeFilter).lte = new Date(
          manufacturingDateTo,
        );
      }
    }

    if (expiryDateFrom || expiryDateTo) {
      where.expiryDate = {};
      if (expiryDateFrom) {
        (where.expiryDate as Prisma.DateTimeFilter).gte = new Date(expiryDateFrom);
      }
      if (expiryDateTo) {
        (where.expiryDate as Prisma.DateTimeFilter).lte = new Date(expiryDateTo);
      }
    }

    if (inStock === 'true') {
      where.quantityRemaining = { gt: 0 };
    }

    const orderByField = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'expiryDate';
    const orderBy: Prisma.DrugBatchOrderByWithRelationInput = {
      [orderByField]: sortOrder === 'desc' ? 'desc' : 'asc',
    };

    const [data, total] = await Promise.all([
      this.prisma.drugBatch.findMany({
        where,
        orderBy,
        skip: Math.max(0, Number(skip) || 0),
        take,
        include: {
          drug: { select: { id: true, genericName: true, brandName: true } },
          supplier: { select: { id: true, name: true } },
          fromLocation: { select: { id: true, name: true, locationType: true } },
          toLocation: { select: { id: true, name: true, locationType: true } },
        },
      }),
      this.prisma.drugBatch.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take };
  }

  async findOne(id: string) {
    const batch = await this.prisma.drugBatch.findUnique({
      where: { id },
      include: {
        drug: true,
        supplier: true,
        fromLocation: true,
        toLocation: true,
        grn: true,
      },
    });
    if (!batch) {
      throw new BadRequestException(`Drug batch "${id}" not found.`);
    }
    return batch;
  }
}

