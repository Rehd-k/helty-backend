import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchDrugDto } from './dto/search-drug.dto';
import { CreateDrugDto, UpdateDrugDto } from './dto/drug.dto';
import {
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';
import {
  appendDrugSearchCursor,
  buildDrugSearchCursor,
  buildDrugSearchOrderBy,
  hasNumberFilter,
  isDrugSearchComputedSort,
  resolveDrugSearchDbSort,
  sortDrugSearchPage,
  summarizeDrugBatches,
} from './pharmacy.drug-search.util';

@Injectable()
export class PharmacyDrugService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDrugDto, createdById: string) {
    // Generate a random service code in the format "PHAR" + 6 digit number (e.g., PHAR000002)
    function generateServiceCode(): string {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);
      return `PHAR${randomNumber}`;
    }
    const generatedServiceCode = generateServiceCode();
    dto.searviceCode = generatedServiceCode;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdDrug = await tx.drug.create({
          data: {
            genericName: dto.genericName.trim(),
            searviceCode: dto.searviceCode.trim(),
            brandName: dto.brandName.trim(),
            strength: dto.strength?.trim() ?? null,
            dosageForm: dto.dosageForm?.trim() ?? null,
            route: dto.route?.trim() ?? null,
            therapeuticClass: dto.therapeuticClass?.trim() ?? null,
            atcCode: dto.atcCode?.trim() ?? null,
            manufacturerId: dto.manufacturerId ?? null,
            isControlled: dto.isControlled ?? false,
            isRefrigerated: dto.isRefrigerated ?? false,
            isHighAlert: dto.isHighAlert ?? false,
            maxDailyDose:
              dto.maxDailyDose != null
                ? new Prisma.Decimal(dto.maxDailyDose)
                : null,
            reorderLevel: dto.reorderLevel ?? 0,
            reorderQuantity: dto.reorderQuantity ?? 0,
            createdById,
            updatedById: createdById,
          },
        });

        if (dto.prices?.length) {
          await tx.drugPrice.createMany({
            data: dto.prices.map((item) => ({
              drugId: createdDrug.id,
              wardId: item.wardId,
              price: new Prisma.Decimal(Number(item.price)),
            })),
          });
        }

        return tx.drug.findUnique({
          where: { id: createdDrug.id },
          include: { manufacturer: true, drugPrices: true },
        });
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException(
            'A drug with this service code may already exist.',
          );
        }
        if (e.code === 'P2003') {
          throw new BadRequestException('Invalid manufacturer ID.');
        }
      }
      throw new BadRequestException('Invalid drug data.');
    }
  }

  async findOne(id: string) {
    const sellableWhere = await getSellableDrugBatchWhere(this.prisma);
    const [drug, batchSum, latestCostBatch] = await Promise.all([
      this.prisma.drug.findFirst({
        where: { id, deletedAt: null },
        include: {
          manufacturer: true,
          drugPrices: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { batches: true, prescriptionItems: true } },
        },
      }),
      this.prisma.drugBatch.aggregate({
        where: mergeDrugBatchWhere(sellableWhere, { drugId: id }),
        _sum: { quantityRemaining: true },
      }),
      this.prisma.drugBatch.findFirst({
        where: { drugId: id },
        orderBy: { createdAt: 'desc' },
        select: { costPrice: true },
      }),
    ]);
    if (!drug) {
      throw new NotFoundException(`Drug "${id}" not found.`);
    }
    const quantity = batchSum._sum.quantityRemaining ?? 0;
    const cost = latestCostBatch?.costPrice ?? null;
    return { ...drug, quantity, cost };
  }

  async update(id: string, dto: UpdateDrugDto, updatedById: string) {
    await this.findOne(id);
    try {
      const data: Prisma.DrugUpdateInput = {
        ...(dto.genericName != null && {
          genericName: dto.genericName.trim(),
        }),
        ...(dto.searviceCode != null && {
          searviceCode: dto.searviceCode.trim(),
        }),
        ...(dto.brandName != null && { brandName: dto.brandName.trim() }),
        ...(dto.strength != null && {
          strength: dto.strength?.trim() ?? null,
        }),
        ...(dto.dosageForm != null && {
          dosageForm: dto.dosageForm?.trim() ?? null,
        }),
        ...(dto.route != null && { route: dto.route?.trim() ?? null }),
        ...(dto.therapeuticClass != null && {
          therapeuticClass: dto.therapeuticClass?.trim() ?? null,
        }),
        ...(dto.atcCode != null && {
          atcCode: dto.atcCode?.trim() ?? null,
        }),
        ...(dto.manufacturerId !== null && {
          manufacturerId: dto.manufacturerId,
        }),
        ...(dto.isControlled !== undefined && {
          isControlled: dto.isControlled,
        }),
        ...(dto.isRefrigerated !== undefined && {
          isRefrigerated: dto.isRefrigerated,
        }),
        ...(dto.isHighAlert !== undefined && { isHighAlert: dto.isHighAlert }),
        ...(dto.maxDailyDose !== undefined && {
          maxDailyDose:
            dto.maxDailyDose != null
              ? new Prisma.Decimal(dto.maxDailyDose)
              : null,
        }),
        ...(dto.reorderLevel !== undefined && {
          reorderLevel: dto.reorderLevel,
        }),
        ...(dto.reorderQuantity !== undefined && {
          reorderQuantity: dto.reorderQuantity,
        }),
        updatedBy: { connect: { id: updatedById } },
      };

      return await this.prisma.$transaction(async (tx) => {
        await tx.drug.update({
          where: { id },
          data,
        });

        if (dto.prices !== undefined) {
          await tx.drugPrice.deleteMany({ where: { drugId: id } });
          if (dto.prices.length) {
            await tx.drugPrice.createMany({
              data: dto.prices.map((item) => ({
                drugId: id,
                wardId: item.wardId,
                price: new Prisma.Decimal(item.price),
              })),
            });
          }
        }

        return tx.drug.findUnique({
          where: { id },
          include: { manufacturer: true, drugPrices: true },
        });
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException(
            'A drug with this service code may already exist.',
          );
        }
        if (e.code === 'P2003') {
          throw new BadRequestException('Invalid manufacturer ID.');
        }
      }
      throw new BadRequestException('Invalid drug data.');
    }
  }

  async remove(id: string, updatedById?: string) {
    const drug = await this.prisma.drug.findFirst({
      where: { id, deletedAt: null },
    });
    if (!drug) {
      throw new NotFoundException(`Drug "${id}" not found.`);
    }

    const sellableWhere = await getSellableDrugBatchWhere(this.prisma);
    const stockSum = await this.prisma.drugBatch.aggregate({
      where: mergeDrugBatchWhere(sellableWhere, { drugId: id }),
      _sum: { quantityRemaining: true },
    });
    const sellableQty = stockSum._sum.quantityRemaining ?? 0;
    if (sellableQty > 0) {
      throw new BadRequestException(
        'Cannot hide drug while sellable stock remains. Deplete or transfer stock first.',
      );
    }

    return this.prisma.drug.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(updatedById != null && { updatedById }),
      },
    });
  }

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
      cursorSortValue,
      sortBy,
      sortOrder = 'desc',
    } = dto;

    const hasCursor = Boolean(cursorId || cursorCreatedAt);
    if (hasCursor && (!cursorId || !cursorCreatedAt)) {
      throw new BadRequestException(
        'cursorId and cursorCreatedAt must be provided together.',
      );
    }
    if (hasCursor && isDrugSearchComputedSort(sortBy)) {
      throw new BadRequestException(
        'Cursor pagination is not supported when sorting by quantity, sellingPrice, or expiryDate.',
      );
    }

    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const sellableWhere = await getSellableDrugBatchWhere(this.prisma);
    const dbSortBy = resolveDrugSearchDbSort(sortBy);

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

    const batchFilters: Prisma.DrugBatchWhereInput = {};

    if (locationType) {
      batchFilters.OR = [
        { fromLocation: { locationType } },
        { toLocation: { locationType } },
      ];
    }

    if (search) {
      where.OR = [
        { genericName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (supplierId) {
      batchFilters.supplierId = supplierId;
    }

    if (manufacturingDateFrom || manufacturingDateTo) {
      batchFilters.manufacturingDate = {};
      if (manufacturingDateFrom) {
        (batchFilters.manufacturingDate as Prisma.DateTimeFilter).gte =
          new Date(manufacturingDateFrom);
      }
      if (manufacturingDateTo) {
        (batchFilters.manufacturingDate as Prisma.DateTimeFilter).lte =
          new Date(manufacturingDateTo);
      }
    }

    if (expiryDateFrom || expiryDateTo) {
      batchFilters.expiryDate = {};
      if (expiryDateFrom) {
        (batchFilters.expiryDate as Prisma.DateTimeFilter).gte = new Date(
          expiryDateFrom,
        );
      }
      if (expiryDateTo) {
        (batchFilters.expiryDate as Prisma.DateTimeFilter).lte = new Date(
          expiryDateTo,
        );
      }
    }

    if (hasNumberFilter(minCostPrice) || hasNumberFilter(maxCostPrice)) {
      batchFilters.costPrice = {};
      if (hasNumberFilter(minCostPrice)) {
        (batchFilters.costPrice as Prisma.DecimalFilter).gte =
          new Prisma.Decimal(minCostPrice);
      }
      if (hasNumberFilter(maxCostPrice)) {
        (batchFilters.costPrice as Prisma.DecimalFilter).lte =
          new Prisma.Decimal(maxCostPrice);
      }
    }

    if (hasNumberFilter(minSellingPrice) || hasNumberFilter(maxSellingPrice)) {
      batchFilters.sellingPrice = {};
      if (hasNumberFilter(minSellingPrice)) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).gte =
          new Prisma.Decimal(minSellingPrice);
      }
      if (hasNumberFilter(maxSellingPrice)) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).lte =
          new Prisma.Decimal(maxSellingPrice);
      }
    }

    const hasBatchFilters = Object.keys(batchFilters).length > 0;
    const sellableWithStock = mergeDrugBatchWhere(sellableWhere);

    if (inStock === 'true') {
      where.batches = {
        some: hasBatchFilters
          ? mergeDrugBatchWhere(sellableWhere, batchFilters)
          : sellableWithStock,
      };
    } else if (inStock === 'false') {
      const andParts: Prisma.DrugWhereInput[] = [
        { batches: { none: sellableWithStock } },
      ];
      if (hasBatchFilters) {
        andParts.push({ batches: { some: batchFilters } });
      }
      const existingAnd = where.AND;
      where.AND = [
        ...(Array.isArray(existingAnd)
          ? existingAnd
          : existingAnd
            ? [existingAnd]
            : []),
        ...andParts,
      ];
    } else if (hasBatchFilters) {
      where.batches = {
        some: mergeDrugBatchWhere(sellableWhere, batchFilters),
      };
    }

    const batchesIncludeWhere = hasBatchFilters
      ? mergeDrugBatchWhere(sellableWhere, batchFilters)
      : sellableWhere;

    if (cursorId && cursorCreatedAt) {
      appendDrugSearchCursor(where, {
        cursorId,
        cursorCreatedAt: new Date(cursorCreatedAt),
        cursorSortValue,
        dbSortBy,
        sortOrder,
      });
    }

    const orderBy = buildDrugSearchOrderBy(dbSortBy, sortOrder);

    const drugs = await this.prisma.drug.findMany({
      where,
      orderBy,
      take: take + 1,
      include: {
        manufacturer: true,
        batches: { where: batchesIncludeWhere },
        drugPrices: {
          include: {
            ward: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    let nextCursor: ReturnType<typeof buildDrugSearchCursor> | null = null;
    if (drugs.length > take) {
      const last = drugs.pop()!;
      nextCursor = buildDrugSearchCursor(last, dbSortBy);
    }

    let data = drugs.map((drug) => {
      const { quantity, sellingPrice, expiryDate } = summarizeDrugBatches(
        drug.batches ?? [],
      );
      return {
        ...drug,
        quantity,
        sellingPrice,
        expiryDate,
      };
    });

    if (sortBy && isDrugSearchComputedSort(sortBy)) {
      data = sortDrugSearchPage(data, sortBy, sortOrder);
    }

    return {
      data,
      nextCursor,
      nextCursorId: nextCursor?.id ?? null,
      nextCursorCreatedAt: nextCursor?.createdAt?.toISOString() ?? null,
      nextCursorSortValue: nextCursor?.sortValue ?? null,
    };
  }
}
