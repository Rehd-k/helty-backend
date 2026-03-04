import { Injectable } from '@nestjs/common';
import { Prisma, PharmacyLocationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchDrugDto } from './dto/search-drug.dto';

@Injectable()
export class PharmacyDrugService {
  constructor(private readonly prisma: PrismaService) { }

  async search(dto: SearchDrugDto) {
    const {
      genericName,
      brandName,
      manufacturerId,
      supplierId,
      manufacturingDateFrom,
      manufacturingDateTo,
      expiryDateFrom,
      expiryDateTo,
      minCostPrice,
      maxCostPrice,
      minSellingPrice,
      maxSellingPrice,
      locationType,
      inStock,
      isControlled,
      search,
      limit = '20',
      cursorId,
      cursorCreatedAt,
      sortBy,
      sortOrder = 'desc',
    } = dto;

    const take = Math.min(parseInt(limit, 10) || 20, 100);

    const where: Prisma.DrugWhereInput = {
      deletedAt: null,
    };

    if (genericName) {
      where.genericName = { contains: genericName, mode: 'insensitive' };
    }
    if (brandName) {
      where.brandName = { contains: brandName, mode: 'insensitive' };
    }
    if (manufacturerId) {
      where.manufacturerId = manufacturerId;
    }
    if (isControlled !== undefined) {
      where.isControlled = isControlled === 'true';
    }

    // Batch-related filters via some / every / OR
    const batchFilters: Prisma.DrugBatchWhereInput = {};

    if (locationType) {
      batchFilters.locationType = locationType as PharmacyLocationType;
    }

    if (supplierId) {
      batchFilters.supplierId = supplierId;
    }

    if (manufacturingDateFrom || manufacturingDateTo) {
      batchFilters.manufacturingDate = {};
      if (manufacturingDateFrom) {
        (batchFilters.manufacturingDate as Prisma.DateTimeFilter).gte = new Date(
          manufacturingDateFrom,
        );
      }
      if (manufacturingDateTo) {
        (batchFilters.manufacturingDate as Prisma.DateTimeFilter).lte = new Date(
          manufacturingDateTo,
        );
      }
    }

    if (expiryDateFrom || expiryDateTo) {
      batchFilters.expiryDate = {};
      if (expiryDateFrom) {
        (batchFilters.expiryDate as Prisma.DateTimeFilter).gte = new Date(expiryDateFrom);
      }
      if (expiryDateTo) {
        (batchFilters.expiryDate as Prisma.DateTimeFilter).lte = new Date(expiryDateTo);
      }
    }

    if (minCostPrice || maxCostPrice) {
      batchFilters.costPrice = {};
      if (minCostPrice) {
        (batchFilters.costPrice as Prisma.DecimalFilter).gte = new Prisma.Decimal(minCostPrice);
      }
      if (maxCostPrice) {
        (batchFilters.costPrice as Prisma.DecimalFilter).lte = new Prisma.Decimal(maxCostPrice);
      }
    }

    if (minSellingPrice || maxSellingPrice) {
      batchFilters.sellingPrice = {};
      if (minSellingPrice) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).gte = new Prisma.Decimal(
          minSellingPrice,
        );
      }
      if (maxSellingPrice) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).lte = new Prisma.Decimal(
          maxSellingPrice,
        );
      }
    }

    if (inStock !== undefined) {
      const positive = inStock === 'true';
      batchFilters.quantityRemaining = positive
        ? { gt: 0 }
        : { equals: 0 };
    }

    if (Object.keys(batchFilters).length) {
      where.batches = {
        some: batchFilters,
      };
    }

    const orderBy: Prisma.DrugOrderByWithRelationInput[] = [];
    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder });
    }
    orderBy.push({ createdAt: sortOrder });
    orderBy.push({ id: sortOrder });

    const cursor =
      cursorId && cursorCreatedAt
        ? {
          id_createdAt: {
            id: cursorId,
            createdAt: new Date(cursorCreatedAt),
          },
        }
        : undefined;

    // Full-text search via raw query when `search` provided
    if (search) {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: string }>
      >(
        `
        SELECT id
        FROM "Drug"
        WHERE "deletedAt" IS NULL
        AND to_tsvector('english', "genericName" || ' ' || "brandName") @@ plainto_tsquery($1)
      `,
        search,
      );
      const ids = rows.map((r) => r.id);
      if (!ids.length) {
        return { data: [], nextCursor: null };
      }
      where.id = { in: ids };
    }

    const drugs = await this.prisma.drug.findMany({
      where,
      orderBy,
      take: take + 1,
      include: {
        manufacturer: true,
      },
    });

    let nextCursor: { id: string; createdAt: Date } | null = null;
    if (drugs.length > take) {
      const last = drugs.pop()!;
      nextCursor = { id: last.id, createdAt: last.createdAt };
    }

    return {
      data: drugs,
      nextCursor,
    };
  }
}

