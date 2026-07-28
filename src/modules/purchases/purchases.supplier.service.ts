import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchasesSupplierDto,
  ListPurchasesSupplierDto,
  UpdatePurchasesSupplierDto,
} from './dto/supplier.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

const ALLOWED_SORT = new Set(['name', 'rating', 'createdAt']);

@Injectable()
export class PurchasesSupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchasesSupplierDto, createdById: string) {
    return this.prisma.purchasesSupplier.create({
      data: {
        name: dto.name.trim(),
        licenseNumber: dto.licenseNumber?.trim() ?? null,
        contactInfo: (dto.contactInfo ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        creditTerms: dto.creditTerms?.trim() ?? null,
        leadTimeDays: dto.leadTimeDays ?? null,
        rating: dto.rating ?? null,
        isBlacklisted: dto.isBlacklisted ?? false,
        createdById,
      },
    });
  }

  async findAll(query: ListPurchasesSupplierDto) {
    const {
      search,
      isBlacklisted,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.PurchasesSupplierWhereInput = {};
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { licenseNumber: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (isBlacklisted === 'true') where.isBlacklisted = true;
    if (isBlacklisted === 'false') where.isBlacklisted = false;
    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };
    const [data, total] = await Promise.all([
      this.prisma.purchasesSupplier.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          _count: { select: { batches: true, purchaseOrders: true } },
          createdBy: { select: staffBriefSelect },
        },
      }),
      this.prisma.purchasesSupplier.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const row = await this.prisma.purchasesSupplier.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, purchaseOrders: true } },
        createdBy: { select: staffBriefSelect },
      },
    });
    if (!row) {
      throw new NotFoundException(`Supplier "${id}" not found.`);
    }
    return row;
  }

  async update(id: string, dto: UpdatePurchasesSupplierDto) {
    await this.findOne(id);
    return this.prisma.purchasesSupplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.licenseNumber !== undefined && {
          licenseNumber: dto.licenseNumber?.trim() ?? null,
        }),
        ...(dto.contactInfo !== undefined && {
          contactInfo: dto.contactInfo as Prisma.InputJsonValue,
        }),
        ...(dto.creditTerms !== undefined && {
          creditTerms: dto.creditTerms?.trim() ?? null,
        }),
        ...(dto.leadTimeDays !== undefined && {
          leadTimeDays: dto.leadTimeDays,
        }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.isBlacklisted !== undefined && {
          isBlacklisted: dto.isBlacklisted,
        }),
      },
    });
  }

  async remove(id: string) {
    const row = await this.prisma.purchasesSupplier.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, purchaseOrders: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`Supplier "${id}" not found.`);
    }
    if (row._count.batches > 0 || row._count.purchaseOrders > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with linked batches or purchase orders.',
      );
    }
    return this.prisma.purchasesSupplier.delete({ where: { id } });
  }
}
