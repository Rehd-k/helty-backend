import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from './dto/create-service-category.dto';

@Injectable()
export class ServiceCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateServiceCategoryDto, req) {
    return this.prisma.serviceCategory.create({
      data: { ...dto, createdById: req.user.sub },
    });
  }

  async findAll() {
    const categories = await this.prisma.serviceCategory.findMany();
    return { categories };
  }

  async findOne(id: string) {
    return this.prisma.serviceCategory.findUnique({
      where: { id },
      include: { services: true },
    });
  }

  async update(id: string, dto: UpdateServiceCategoryDto) {
    return this.prisma.serviceCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.serviceCategory.delete({ where: { id } });
  }
}
