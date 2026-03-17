import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { ListSupplierDto } from './dto/list-supplier.dto';

const ALLOWED_SORT = new Set(['name', 'rating', 'createdAt']);

@Injectable()
export class PharmacySupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
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
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A supplier with this name or license may already exist.',
        );
      }
      throw new BadRequestException('Invalid supplier data.');
    }
  }

  async findAll(query: ListSupplierDto) {
    const {
      search,
      isBlacklisted,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.SupplierWhereInput = {};

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
      this.prisma.supplier.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          _count: { select: { batches: true, purchaseOrders: true } },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, purchaseOrders: true } },
      },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${id}" not found.`);
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    try {
      return await this.prisma.supplier.update({
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
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A supplier with this name or license may already exist.',
        );
      }
      throw new BadRequestException('Invalid supplier data.');
    }
  }

  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, purchaseOrders: true } },
      },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${id}" not found.`);
    }
    if (supplier._count.batches > 0 || supplier._count.purchaseOrders > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with linked batches or purchase orders. Remove or reassign them first.',
      );
    }
    return this.prisma.supplier.delete({ where: { id } });
  }
}
