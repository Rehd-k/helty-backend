import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabCategoryDto } from './dto/create-lab-category.dto';
import { UpdateLabCategoryDto } from './dto/update-lab-category.dto';

@Injectable()
export class LabCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabCategoryDto) {
    return this.prisma.labCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAll(skip = 0, take = 50) {
    const [data, total] = await Promise.all([
      this.prisma.labCategory.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.labCategory.count(),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const category = await this.prisma.labCategory.findUnique({
      where: { id },
      include: { tests: { select: { id: true, name: true, isActive: true } } },
    });
    if (!category) {
      throw new NotFoundException(`Lab category "${id}" not found.`);
    }
    return category;
  }

  async update(id: string, dto: UpdateLabCategoryDto) {
    const existing = await this.prisma.labCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Lab category "${id}" not found.`);
    }
    return this.prisma.labCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.labCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Lab category "${id}" not found.`);
    }
    try {
      await this.prisma.labCategory.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(
          `Cannot delete lab category "${id}" while tests are assigned to it.`,
        );
      }
      throw e;
    }
  }
}
