import { Injectable } from '@nestjs/common';
import { Prisma, PharmacyLocationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchBatchDto } from './dto/search-batch.dto';

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
      locationType,
      inStock,
      limit = 50,
    } = dto;

    const where: Prisma.DrugBatchWhereInput = {};

    if (drugId) where.drugId = drugId;
    if (batchNumber) where.batchNumber = batchNumber;
    if (supplierId) where.supplierId = supplierId;
    if (locationType) where.locationType = locationType as PharmacyLocationType;

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

    const batches = await this.prisma.drugBatch.findMany({
      where,
      orderBy: [
        { drugId: 'asc' },
        { locationType: 'asc' },
        { expiryDate: 'asc' },
      ],
      take: Math.min(limit, 200),
      include: {
        drug: true,
        supplier: true,
      },
    });

    return { data: batches };
  }
}

