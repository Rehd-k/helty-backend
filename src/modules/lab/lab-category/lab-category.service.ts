import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabCategoryDto } from './dto/create-lab-category.dto';

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
}
