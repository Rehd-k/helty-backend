import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateManufacturerDto } from './dto/manufacturer.dto';
import { UpdateManufacturerDto } from './dto/manufacturer.dto';
import { ListManufacturerDto } from './dto/list-manufacturer.dto';

const ALLOWED_SORT = new Set(['name', 'country', 'createdAt']);

@Injectable()
export class PharmacyManufacturerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateManufacturerDto) {
    try {
      return await this.prisma.manufacturer.create({
        data: {
          name: dto.name.trim(),
          country: dto.country?.trim() ?? null,
          contactInfo: (dto.contactInfo ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A manufacturer with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid manufacturer data.');
    }
  }

  async findAll(query: ListManufacturerDto) {
    const {
      search,
      country,
      sortBy,
      sortOrder = 'desc',
      skip = 0,
      limit = 20,
    } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.ManufacturerWhereInput = {};

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
      this.prisma.manufacturer.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: { _count: { select: { drugs: true } } },
      }),
      this.prisma.manufacturer.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
      include: {
        drugs: { select: { id: true, genericName: true, brandName: true } },
      },
    });
    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer "${id}" not found.`);
    }
    return manufacturer;
  }

  async update(id: string, dto: UpdateManufacturerDto) {
    await this.findOne(id);
    try {
      return await this.prisma.manufacturer.update({
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
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'A manufacturer with this name may already exist.',
        );
      }
      throw new BadRequestException('Invalid manufacturer data.');
    }
  }

  async remove(id: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
      include: { _count: { select: { drugs: true } } },
    });
    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer "${id}" not found.`);
    }
    if (manufacturer._count.drugs > 0) {
      throw new BadRequestException(
        `Cannot delete manufacturer with ${manufacturer._count.drugs} linked drug(s). Unlink or reassign drugs first.`,
      );
    }
    return this.prisma.manufacturer.delete({ where: { id } });
  }
}
