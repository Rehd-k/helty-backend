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

@Injectable()
export class PharmacyDrugService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateDrugDto, createdById: string) {
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
    const drug = await this.prisma.drug.findFirst({
      where: { id, deletedAt: null },
      include: {
        manufacturer: true,
        drugPrices: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { batches: true, prescriptionItems: true } },
      },
    });
    if (!drug) {
      throw new NotFoundException(`Drug "${id}" not found.`);
    }
    return drug;
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
        ...(dto.manufacturerId !== null) && {
          manufacturerId: dto.manufacturerId,
        },
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
      console.log(data);
      return await this.prisma.$transaction(async (tx) => {
        await tx.drug.update({
          where: { id },
          data,
        });

        if (dto.prices !== undefined) {
          console.log(dto.prices);
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

  async remove(id: string) {
    const drug = await this.prisma.drug.findFirst({
      where: { id, deletedAt: null },
    });
    if (!drug) {
      throw new NotFoundException(`Drug "${id}" not found.`);
    }
    return this.prisma.drug.update({
      where: { id },
      data: { deletedAt: new Date() },
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

    // Batch-related filters via some (DrugBatch has fromLocation/toLocation, not locationType)
    const batchFilters: Prisma.DrugBatchWhereInput = {};

    if (locationType) {
      const locType = locationType;
      batchFilters.OR = [
        { fromLocation: { locationType: locType } },
        { toLocation: { locationType: locType } },
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

    if (minCostPrice || maxCostPrice) {
      batchFilters.costPrice = {};
      if (minCostPrice) {
        (batchFilters.costPrice as Prisma.DecimalFilter).gte =
          new Prisma.Decimal(minCostPrice);
      }
      if (maxCostPrice) {
        (batchFilters.costPrice as Prisma.DecimalFilter).lte =
          new Prisma.Decimal(maxCostPrice);
      }
    }

    if (minSellingPrice || maxSellingPrice) {
      batchFilters.sellingPrice = {};
      if (minSellingPrice) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).gte =
          new Prisma.Decimal(minSellingPrice);
      }
      if (maxSellingPrice) {
        (batchFilters.sellingPrice as Prisma.DecimalFilter).lte =
          new Prisma.Decimal(maxSellingPrice);
      }
    }

    if (inStock !== undefined) {
      const positive = inStock === 'true';
      batchFilters.quantityRemaining = positive ? { gt: 0 } : { equals: 0 };
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
    console.log(orderBy)

    const drugs = await this.prisma.drug.findMany({
      where,
      orderBy,
      take: take + 1,
      include: {
        manufacturer: true,
        batches: true,
        drugPrices: {
          include: {
            ward: {
              select: {
                name: true
              }
            }
          }
        }
      },
    });

    let nextCursor: { id: string; createdAt: Date } | null = null;
    if (drugs.length > take) {
      const last = drugs.pop()!;
      nextCursor = { id: last.id, createdAt: last.createdAt };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = drugs.map((drug) => {
      const batches = drug.batches ?? [];
      const quantity = batches.reduce(
        (sum, b) => sum + (b.quantityRemaining ?? 0),
        0,
      );
      const earliestBatch = batches.length
        ? batches.reduce((earliest, b) =>
          b.createdAt < earliest.createdAt ? b : earliest,
        )
        : null;
      const sellingPrice = earliestBatch?.sellingPrice ?? null;
      const expiryDateClosest = batches.length
        ? batches.reduce((closest, b) => {
          const diff = Math.abs(
            new Date(b.expiryDate).getTime() - today.getTime(),
          );
          const closestDiff = Math.abs(
            new Date(closest.expiryDate).getTime() - today.getTime(),
          );
          return diff < closestDiff ? b : closest;
        }).expiryDate
        : null;

      const { batches: _batches, ...rest } = drug;
      return {
        ...rest,
        batches: _batches,
        quantity,
        sellingPrice,
        expiryDate: expiryDateClosest,
      };
    });
    return {
      data,
      nextCursor,
    };
  }
}
