import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDepartmentDto, req) {
    data.createdById = req.user.sub;
    return this.prisma.department.create({
      data: data as Prisma.DepartmentCreateInput,
    });
  }

  async findAll() {
    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          createdBy: { select: staffBriefSelect },
        },
      }),
      this.prisma.department.count(),
    ]);

    return { departments, total };
  }

  async findOne(id: string) {
    const dep = await this.prisma.department.findUnique({
      where: { id },
      include: {
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
      },
    });
    if (!dep) throw new NotFoundException('Department not found');
    return dep;
  }

  async update(
    id: string,
    data: Prisma.DepartmentUpdateInput,
    staffId: string,
  ) {
    return this.prisma.department.update({
      where: { id },
      data: {
        ...data,
        updatedBy: { connect: { id: staffId } },
      },
      include: {
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
