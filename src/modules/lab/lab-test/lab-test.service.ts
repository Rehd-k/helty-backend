import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';

@Injectable()
export class LabTestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabTestDto) {
    const category = await this.prisma.labCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Lab category "${dto.categoryId}" not found.`,
      );
    }
    return this.prisma.labTest.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        sampleType: dto.sampleType,
        description: dto.description,
        price: dto.price,
        isActive: dto.isActive ?? true,
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async findAll(query: ListTestsQueryDto) {
    try {
      const where: { categoryId?: string; isActive?: boolean } = {};
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.isActive !== undefined) where.isActive = query.isActive;

      const skip = query.skip ?? 0;
      const take = query.take ?? 20;

      const [data, total] = await Promise.all([
        this.prisma.labTest.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: { category: { select: { id: true, name: true } } },
        }),
        this.prisma.labTest.count({ where }),
      ]);
      return { data, total, skip, take };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findOne(id: string) {
    const test = await this.prisma.labTest.findUnique({
      where: { id },
      include: {
        category: true,
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!test) {
      throw new NotFoundException(`Lab test "${id}" not found.`);
    }
    return test;
  }

  async update(id: string, dto: UpdateLabTestDto) {
    const existing = await this.prisma.labTest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lab test "${id}" not found.`);
    }
    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.labCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Lab category "${dto.categoryId}" not found.`,
        );
      }
    }
    return this.prisma.labTest.update({
      where: { id },
      data: dto,
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.labTest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lab test "${id}" not found.`);
    }
    try {
      await this.prisma.labTest.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(
          `Cannot delete lab test "${id}" while orders or related data reference its versions.`,
        );
      }
      throw e;
    }
  }
}
