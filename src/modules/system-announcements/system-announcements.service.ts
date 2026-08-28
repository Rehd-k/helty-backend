import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSystemAnnouncementDto,
  ListSystemAnnouncementsQueryDto,
  UpdateSystemAnnouncementDto,
} from './dto/system-announcement.dto';

const STAFF_INCLUDE = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  updatedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
} as const;

@Injectable()
export class SystemAnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  private activeWhere(): Prisma.SystemAnnouncementWhereInput {
    const now = new Date();
    return {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }

  async listActive() {
    return this.prisma.systemAnnouncement.findMany({
      where: this.activeWhere(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        iconKey: true,
        sortOrder: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateSystemAnnouncementDto, staffId: string) {
    return this.prisma.systemAnnouncement.create({
      data: {
        title: dto.title,
        description: dto.description,
        iconKey: dto.iconKey ?? 'info',
        isActive: dto.isActive ?? false,
        sortOrder: dto.sortOrder ?? 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: staffId,
      },
      include: STAFF_INCLUDE,
    });
  }

  async list(query: ListSystemAnnouncementsQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    const where: Prisma.SystemAnnouncementWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    const [data, total] = await Promise.all([
      this.prisma.systemAnnouncement.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: STAFF_INCLUDE,
      }),
      this.prisma.systemAnnouncement.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async get(id: string) {
    const row = await this.prisma.systemAnnouncement.findUnique({
      where: { id },
      include: STAFF_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`System announcement "${id}" not found.`);
    }
    return row;
  }

  async update(
    id: string,
    dto: UpdateSystemAnnouncementDto,
    staffId: string,
  ) {
    await this.get(id);
    const data: Prisma.SystemAnnouncementUpdateInput = {
      updatedBy: { connect: { id: staffId } },
    };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.iconKey !== undefined) data.iconKey = dto.iconKey;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    return this.prisma.systemAnnouncement.update({
      where: { id },
      data,
      include: STAFF_INCLUDE,
    });
  }

  async delete(id: string) {
    await this.get(id);
    return this.prisma.systemAnnouncement.delete({ where: { id } });
  }
}
