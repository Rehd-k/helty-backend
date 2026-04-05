import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDrugPriceDto,
  SearchDrugPriceDto,
  UpdateDrugPriceDto,
} from './dto/drug-price.dto';

@Injectable()
export class PharmacyDrugPriceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDrugPriceDto) {
    const { drugId, wardId, price } = dto;
    if (!drugId || !wardId || price === undefined || price === null) {
      throw new BadRequestException(
        'drugId, wardId and price are required for creating a drug price entry.',
      );
    }

    try {
      return await this.prisma.drugPrice.create({
        data: {
          drugId,
          wardId,
          price: new Prisma.Decimal(price),
        },
        include: {
          drug: true,
          ward: true,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException(
            'A drug price entry for this drug + ward already exists.',
          );
        }
        if (e.code === 'P2003') {
          throw new BadRequestException('Invalid drug or ward ID supplied.');
        }
      }
      throw new BadRequestException('Invalid drug price data.');
    }
  }

  async findAll(query: SearchDrugPriceDto) {
    const {
      drugId,
      wardId,
      minPrice,
      maxPrice,
      search,
      skip = 0,
      limit = 20, 
      sortOrder,
    } = query;
    const take = Math.min(Math.max(1, limit), 100);

    const where: Prisma.DrugPriceWhereInput = {};

    if (drugId) where.drugId = drugId;
    if (wardId) where.wardId = wardId;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {} as Prisma.DecimalFilter;
      if (minPrice !== undefined) {
        (where.price as Prisma.DecimalFilter).gte = new Prisma.Decimal(
          minPrice.toString(),
        );
      }
      if (maxPrice !== undefined) {
        (where.price as Prisma.DecimalFilter).lte = new Prisma.Decimal(
          maxPrice.toString(),
        );
      }
    }
    if (search?.trim()) {
      const needle = search.trim();
      where.OR = [
        { drugId: { contains: needle, mode: 'insensitive' } },
        { wardId: { contains: needle, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.drugPrice.findMany({
        where,
        skip: Math.max(0, skip),
        take,
        orderBy: { createdAt: sortOrder ?? 'desc' },
        include: {
          drug: true,
          ward: true,
        },
      }),
      this.prisma.drugPrice.count({ where }),
    ]);

    return {
      data,
      total,
      skip: Math.max(0, skip),
      take,
    };
  }

  async findOne(id: string) {
    const drugPrice = await this.prisma.drugPrice.findUnique({
      where: { id },
      include: {
        drug: true,
        ward: true,
      },
    });
    if (!drugPrice) {
      throw new NotFoundException(`DrugPrice entry "${id}" not found.`);
    }
    return drugPrice;
  }

  async update(id: string, dto: UpdateDrugPriceDto) {
    await this.findOne(id);
    try {
      const payload: Prisma.DrugPriceUpdateInput = {
        ...(dto.drugId !== undefined && {
          drug: { connect: { id: dto.drugId } },
        }),
        ...(dto.wardId !== undefined && {
          ward: { connect: { id: dto.wardId } },
        }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
      };

      return this.prisma.drugPrice.update({
        where: { id },
        data: payload,
        include: {
          drug: true,
          ward: true,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException(
            'Updating this drug price would conflict with an existing drug+ward entry.',
          );
        }
        if (e.code === 'P2003') {
          throw new BadRequestException('Invalid drug or ward ID supplied.');
        }
      }
      throw new BadRequestException('Invalid drug price data.');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.drugPrice.delete({
      where: { id },
    });
  }
}
