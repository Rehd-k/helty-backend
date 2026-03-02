import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Service CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new hospital service.
   * The authenticated staff member is recorded as `createdBy`.
   */

  async create(dto: any, userId: string) {
    try {
      return await this.prisma.service.create({
        data: {
          ...dto,
          createdById: userId,
        },
        include: {
          category: true,
          department: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('A service with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Paginated list of all services with category and department info.
   */
  async findAll(skip = 0, take = 10, search: string = '', filterCategory: string = '', departmentId: string = '', categoryId: string = '') {

    const where: Prisma.ServiceWhereInput = {}

    if (search && search.trim() !== '') {
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }

    if (filterCategory && filterCategory.trim() !== '') {
      where.category = {
        name: {
          contains: filterCategory,
          mode: 'insensitive',
        },
      }
    }

    if (departmentId && departmentId.trim() !== '') {
      where.department = {
        id: departmentId,
      }
    }

    if (categoryId && categoryId.trim() !== '') {
      where.categoryId = categoryId
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          department: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        where,
      }),
      this.prisma.service.count({
        where
      }),
    ]);
    return { services, total, skip, take };
  }

  /**
   * Get a single service by ID including invoice items.
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        department: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            invoice: { select: { id: true, status: true, patientId: true } },
          },
        },
      },
    });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  /**
   * Update a service. Tracks who made the update via `updatedBy`.
   */
  async update(id: string, dto: UpdateServiceDto, req: any) {
    await this.findOne(id);
    return this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        cost: dto.cost,
        categoryId: dto.categoryId,
        departmentId: dto.departmentId,
        updatedById: req.user.sub,
      },
      include: {
        category: true,
        department: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a service. Fails if any invoice items reference it.
   */
  async remove(id: string) {
    await this.findOne(id);
    const itemCount = await this.prisma.invoiceItem.count({
      where: { serviceId: id },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete service: referenced by ${itemCount} invoice item(s).`,
      );
    }
    return this.prisma.service.delete({ where: { id } });
  }
}
