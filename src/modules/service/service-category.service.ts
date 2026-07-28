import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from './dto/create-service-category.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class ServiceCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateServiceCategoryDto, req) {
    return this.prisma.serviceCategory.create({
      data: { ...dto, createdById: req.user.sub },
    });
  }

  async findAll() {
    const categories = await this.prisma.serviceCategory.findMany({
      include: {
        createdBy: { select: staffBriefSelect },
      },
    });
    return { categories };
  }

  async findOne(id: string) {
    return this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        services: true,
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
      },
    });
  }

  async update(
    id: string,
    dto: UpdateServiceCategoryDto,
    staffId: string,
  ) {
    return this.prisma.serviceCategory.update({
      where: { id },
      data: { ...dto, updatedById: staffId },
      include: {
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.serviceCategory.delete({ where: { id } });
  }
}
