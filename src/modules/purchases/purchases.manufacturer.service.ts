import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePurchasesManufacturerDto,
  ListPurchasesManufacturerDto,
  UpdatePurchasesManufacturerDto,
} from './dto/manufacturer.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

const ALLOWED_SORT = new Set(['name', 'country', 'createdAt']);

@Injectable()
export class PurchasesManufacturerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchasesManufacturerDto, createdById: string) {
    return this.prisma.purchasesManufacturer.create({
      data: {
        name: dto.name.trim(),
        country: dto.country?.trim() ?? null,
        contactInfo: (dto.contactInfo ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdById,
      },
    });
  }

  async findAll(query: ListPurchasesManufacturerDto) {
    const { search, country, sortBy, sortOrder = 'desc', skip = 0, limit = 20 } =
      query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.PurchasesManufacturerWhereInput = {};
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { country: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (country?.trim()) {
      where.country = { contains: country.trim(), mode: 'insensitive' };
    }
    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };
    const [data, total] = await Promise.all([
      this.prisma.purchasesManufacturer.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          _count: { select: { items: true } },
          createdBy: { select: staffBriefSelect },
        },
      }),
      this.prisma.purchasesManufacturer.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const row = await this.prisma.purchasesManufacturer.findUnique({
      where: { id },
      include: {
        items: { select: { id: true, itemName: true } },
        createdBy: { select: staffBriefSelect },
      },
    });
    if (!row) {
      throw new NotFoundException(`Manufacturer "${id}" not found.`);
    }
    return row;
  }

  async update(id: string, dto: UpdatePurchasesManufacturerDto) {
    await this.findOne(id);
    return this.prisma.purchasesManufacturer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.country !== undefined && {
          country: dto.country?.trim() ?? null,
        }),
        ...(dto.contactInfo !== undefined && {
          contactInfo: dto.contactInfo as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(id: string) {
    const row = await this.prisma.purchasesManufacturer.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!row) {
      throw new NotFoundException(`Manufacturer "${id}" not found.`);
    }
    if (row._count.items > 0) {
      throw new BadRequestException(
        'Cannot delete manufacturer with linked items.',
      );
    }
    return this.prisma.purchasesManufacturer.delete({ where: { id } });
  }
}
