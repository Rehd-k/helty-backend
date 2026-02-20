import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({ data });
  }

  async findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const dep = await this.prisma.department.findUnique({ where: { id } });
    if (!dep) throw new NotFoundException('Department not found');
    return dep;
  }

  async update(id: string, data: Prisma.DepartmentUpdateInput) {
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
