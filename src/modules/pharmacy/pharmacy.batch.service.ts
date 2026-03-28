import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PharmacyLocationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/batch.dto';
import { SearchBatchDto } from './dto/search-batch.dto';
import { parseDateRange } from '../../common/utils/date-range';

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
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateBatchDto) {
    const manufacturingDate = new Date(dto.manufacturingDate);
    const expiryDate = new Date(dto.expiryDate);

    this.validateDates(manufacturingDate, expiryDate);

    const quantityRemaining = dto.quantityRemaining ?? dto.quantityReceived;
    if (quantityRemaining > dto.quantityReceived) {
      throw new BadRequestException(
        'quantityRemaining cannot be greater than quantityReceived.',
      );
    }

    const fromLocationId =
      dto.fromLocationId ?? (await this.getDefaultPharmacyLocationId());
    const toLocationId =
      dto.toLocationId ?? (await this.getDefaultPharmacyLocationId());

    await this.ensureReferencesExist({
      drugId: dto.drugId,
      fromLocationId,
      toLocationId,
      supplierId: dto.supplierId,
      grnId: dto.grnId,
    });

    const costPrice = new Prisma.Decimal(Number(dto.costPrice));
    const sellingPrice =
      dto.sellingPrice != null && dto.sellingPrice !== ''
        ? new Prisma.Decimal(Number(dto.sellingPrice))
        : costPrice;

    return this.prisma.drugBatch.create({
      data: {
        drugId: dto.drugId,
        fromLocationId,
        toLocationId,
        batchNumber: dto.batchNumber.trim(),
        manufacturingDate,
        expiryDate,
        supplierId: dto.supplierId ?? null,
        grnId: dto.grnId ?? null,
        costPrice,
        sellingPrice,
        quantityReceived: dto.quantityReceived,
        quantityRemaining,
      },
      include: this.defaultBatchInclude(),
    });
  }

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
      fromDate,
      toDate,
      limit = 20,
      skip = 0,
      sortBy = 'expiryDate',
      sortOrder = 'desc',
    } = dto;

    const take = Math.min(Math.max(1, Number(limit) || 20), 100);
    const { from, to } = parseDateRange(fromDate, toDate);
    const where: Prisma.DrugBatchWhereInput = {
      createdAt: { gte: from, lte: to },
    };

    if (drugId) where.drugId = drugId;
    if (batchNumber) {
      where.batchNumber = { contains: batchNumber, mode: 'insensitive' };
    }
    if (supplierId) where.supplierId = supplierId;
    if (fromLocationId) where.fromLocationId = fromLocationId;
    if (toLocationId) where.toLocationId = toLocationId;
    if (locationType) {
      const locType = locationType;
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
        (where.expiryDate as Prisma.DateTimeFilter).gte = new Date(
          expiryDateFrom,
        );
      }
      if (expiryDateTo) {
        (where.expiryDate as Prisma.DateTimeFilter).lte = new Date(
          expiryDateTo,
        );
      }
    }

    if (inStock === 'true') {
      where.quantityRemaining = { gt: 0 };
    }
    if (inStock === 'false') {
      where.quantityRemaining = { equals: 0 };
    }

    const orderByField = ALLOWED_SORT_FIELDS.has(sortBy)
      ? sortBy
      : 'expiryDate';
    const orderBy: Prisma.DrugBatchOrderByWithRelationInput = {
      [orderByField]: sortOrder === 'desc' ? 'desc' : 'asc',
    };

    const parsedSkip = Math.max(0, Number(skip) || 0);

    const [data, total] = await Promise.all([
      this.prisma.drugBatch.findMany({
        where,
        orderBy,
        skip: parsedSkip,
        take,
        include: this.defaultBatchInclude(),
      }),
      this.prisma.drugBatch.count({ where }),
    ]);
    return { data, total, skip: parsedSkip, take };
  }

  async findOne(id: string) {
    const batch = await this.prisma.drugBatch.findUnique({
      where: { id },
      include: this.defaultBatchInclude(),
    });
    if (!batch) {
      throw new NotFoundException(`Drug batch "${id}" not found.`);
    }
    return batch;
  }

  async update(id: string, dto: UpdateBatchDto) {
    const existing = await this.findOne(id);

    const nextManufacturingDate = dto.manufacturingDate
      ? new Date(dto.manufacturingDate)
      : existing.manufacturingDate;
    const nextExpiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : existing.expiryDate;
    this.validateDates(nextManufacturingDate, nextExpiryDate);

    const nextQuantityReceived =
      dto.quantityReceived ?? existing.quantityReceived;
    const nextQuantityRemaining =
      dto.quantityRemaining ?? existing.quantityRemaining;
    if (nextQuantityRemaining > nextQuantityReceived) {
      throw new BadRequestException(
        'quantityRemaining cannot be greater than quantityReceived.',
      );
    }

    await this.ensureReferencesExist({
      drugId: dto.drugId,
      fromLocationId: dto.fromLocationId,
      toLocationId: dto.toLocationId,
      supplierId: dto.supplierId ?? undefined,
      grnId: dto.grnId ?? undefined,
    });

    return this.prisma.drugBatch.update({
      where: { id },
      data: {
        ...(dto.drugId !== undefined && { drugId: dto.drugId }),
        ...(dto.fromLocationId !== undefined && {
          fromLocationId: dto.fromLocationId,
        }),
        ...(dto.toLocationId !== undefined && {
          toLocationId: dto.toLocationId,
        }),
        ...(dto.batchNumber !== undefined && {
          batchNumber: dto.batchNumber.trim(),
        }),
        ...(dto.manufacturingDate !== undefined && {
          manufacturingDate: nextManufacturingDate,
        }),
        ...(dto.expiryDate !== undefined && { expiryDate: nextExpiryDate }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.grnId !== undefined && { grnId: dto.grnId }),
        ...(dto.costPrice !== undefined && {
          costPrice: new Prisma.Decimal(dto.costPrice),
        }),
        ...(dto.sellingPrice !== undefined && {
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
        }),
        ...(dto.quantityReceived !== undefined && {
          quantityReceived: dto.quantityReceived,
        }),
        ...(dto.quantityRemaining !== undefined && {
          quantityRemaining: dto.quantityRemaining,
        }),
      },
      include: this.defaultBatchInclude(),
    });
  }

  async remove(id: string) {
    const batch = await this.prisma.drugBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            movements: true,
            transferItems: true,
            dispensationItems: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Drug batch "${id}" not found.`);
    }

    if (
      batch._count.movements > 0 ||
      batch._count.transferItems > 0 ||
      batch._count.dispensationItems > 0
    ) {
      throw new BadRequestException(
        'Cannot delete batch with stock movements, transfer items, or dispensations.',
      );
    }

    return this.prisma.drugBatch.delete({ where: { id } });
  }

  private async getDefaultPharmacyLocationId(): Promise<string> {
    const location = await this.prisma.pharmacyLocation.findFirst({
      where: { locationType: PharmacyLocationType.STORE },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException(
        'No pharmacy location found. Create a pharmacy location (e.g. STORE) first, or provide fromLocationId and toLocationId.',
      );
    }
    return location.id;
  }

  private validateDates(manufacturingDate: Date, expiryDate: Date) {
    if (
      Number.isNaN(manufacturingDate.getTime()) ||
      Number.isNaN(expiryDate.getTime())
    ) {
      throw new BadRequestException('Invalid manufacturingDate or expiryDate.');
    }
    if (expiryDate <= manufacturingDate) {
      throw new BadRequestException(
        'expiryDate must be later than manufacturingDate.',
      );
    }
  }

  private async ensureReferencesExist(params: {
    drugId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    supplierId?: string | null;
    grnId?: string | null;
  }) {
    const checks: Promise<unknown>[] = [];

    if (params.drugId) {
      checks.push(
        this.prisma.drug
          .findFirst({
            where: { id: params.drugId, deletedAt: null },
            select: { id: true },
          })
          .then((drug) => {
            if (!drug)
              throw new NotFoundException(`Drug "${params.drugId}" not found.`);
          }),
      );
    }
    if (params.fromLocationId) {
      checks.push(
        this.prisma.pharmacyLocation
          .findUnique({
            where: { id: params.fromLocationId },
            select: { id: true },
          })
          .then((loc) => {
            if (!loc) {
              throw new NotFoundException(
                `From location "${params.fromLocationId}" not found.`,
              );
            }
          }),
      );
    }
    if (params.toLocationId) {
      checks.push(
        this.prisma.pharmacyLocation
          .findUnique({
            where: { id: params.toLocationId },
            select: { id: true },
          })
          .then((loc) => {
            if (!loc) {
              throw new NotFoundException(
                `To location "${params.toLocationId}" not found.`,
              );
            }
          }),
      );
    }
    if (params.supplierId) {
      checks.push(
        this.prisma.supplier
          .findUnique({
            where: { id: params.supplierId },
            select: { id: true },
          })
          .then((supplier) => {
            if (!supplier) {
              throw new NotFoundException(
                `Supplier "${params.supplierId}" not found.`,
              );
            }
          }),
      );
    }
    if (params.grnId) {
      checks.push(
        this.prisma.goodsReceipt
          .findUnique({
            where: { id: params.grnId },
            select: { id: true },
          })
          .then((grn) => {
            if (!grn) {
              throw new NotFoundException(
                `Goods receipt "${params.grnId}" not found.`,
              );
            }
          }),
      );
    }

    await Promise.all(checks);
  }

  private defaultBatchInclude() {
    return {
      drug: { select: { id: true, genericName: true, brandName: true } },
      supplier: { select: { id: true, name: true } },
      fromLocation: { select: { id: true, name: true, locationType: true } },
      toLocation: { select: { id: true, name: true, locationType: true } },
      grn: { select: { id: true, purchaseOrderId: true, receivedAt: true } },
      _count: {
        select: {
          movements: true,
          transferItems: true,
          dispensationItems: true,
        },
      },
    } satisfies Prisma.DrugBatchInclude;
  }
}
