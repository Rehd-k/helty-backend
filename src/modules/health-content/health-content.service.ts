import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateHealthCampaignDto,
  CreateHealthNewsArticleDto,
  ListHealthContentQueryDto,
  UpdateHealthCampaignDto,
  UpdateHealthNewsArticleDto,
} from './dto/health-content.dto';

const STAFF_INCLUDE = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  updatedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
} as const;

@Injectable()
export class HealthContentService {
  constructor(private readonly prisma: PrismaService) {}

  private publishedWhere(): Prisma.HealthCampaignWhereInput {
    const now = new Date();
    return {
      isPublished: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }

  private publishedNewsWhere(): Prisma.HealthNewsArticleWhereInput {
    const now = new Date();
    return {
      isPublished: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }

  private assertHasContent(input: {
    title?: string | null;
    body?: string | null;
    imageUrl?: string | null;
  }) {
    const title = input.title?.trim() ?? '';
    const body = input.body?.trim() ?? '';
    const imageUrl = input.imageUrl?.trim() ?? '';
    if (!title && !body && !imageUrl) {
      throw new BadRequestException(
        'Add a title, a body, or an image. An infographic can stand alone.',
      );
    }
  }

  // ─── Campaigns (staff) ────────────────────────────────────────────────────

  async createCampaign(dto: CreateHealthCampaignDto, staffId: string) {
    const title = dto.title?.trim() ?? '';
    const body = dto.body?.trim() ?? '';
    const imageUrl = dto.imageUrl?.trim() || null;
    this.assertHasContent({ title, body, imageUrl });
    return this.prisma.healthCampaign.create({
      data: {
        title,
        body,
        imageUrl,
        publishedAt: dto.publishedAt
          ? new Date(dto.publishedAt)
          : dto.isPublished
            ? new Date()
            : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isPublished: dto.isPublished ?? false,
        createdById: staffId,
      },
      include: STAFF_INCLUDE,
    });
  }

  async listCampaigns(query: ListHealthContentQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: Prisma.HealthCampaignWhereInput = {};
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }
    const [data, total] = await Promise.all([
      this.prisma.healthCampaign.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: STAFF_INCLUDE,
      }),
      this.prisma.healthCampaign.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async getCampaign(id: string) {
    const row = await this.prisma.healthCampaign.findUnique({
      where: { id },
      include: STAFF_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Health campaign "${id}" not found.`);
    }
    return row;
  }

  async updateCampaign(
    id: string,
    dto: UpdateHealthCampaignDto,
    staffId: string,
  ) {
    const existing = await this.getCampaign(id);
    const title =
      dto.title === undefined ? existing.title : (dto.title?.trim() ?? '');
    const body =
      dto.body === undefined ? existing.body : (dto.body?.trim() ?? '');
    const imageUrl =
      dto.imageUrl !== undefined ? dto.imageUrl : existing.imageUrl;
    this.assertHasContent({ title, body, imageUrl });
    const data: Prisma.HealthCampaignUpdateInput = {
      updatedBy: { connect: { id: staffId } },
      title,
      body,
      imageUrl,
    };
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && dto.publishedAt === undefined && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    return this.prisma.healthCampaign.update({
      where: { id },
      data,
      include: STAFF_INCLUDE,
    });
  }

  async deleteCampaign(id: string) {
    await this.getCampaign(id);
    await this.prisma.healthCampaign.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─── News (staff) ─────────────────────────────────────────────────────────

  async createNews(dto: CreateHealthNewsArticleDto, staffId: string) {
    const title = dto.title?.trim() ?? '';
    const body = dto.body?.trim() ?? '';
    const imageUrl = dto.imageUrl?.trim() || null;
    this.assertHasContent({ title, body, imageUrl });
    return this.prisma.healthNewsArticle.create({
      data: {
        title,
        body,
        imageUrl,
        publishedAt: dto.publishedAt
          ? new Date(dto.publishedAt)
          : dto.isPublished
            ? new Date()
            : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isPublished: dto.isPublished ?? false,
        createdById: staffId,
      },
      include: STAFF_INCLUDE,
    });
  }

  async listNews(query: ListHealthContentQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: Prisma.HealthNewsArticleWhereInput = {};
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }
    const [data, total] = await Promise.all([
      this.prisma.healthNewsArticle.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: STAFF_INCLUDE,
      }),
      this.prisma.healthNewsArticle.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async getNews(id: string) {
    const row = await this.prisma.healthNewsArticle.findUnique({
      where: { id },
      include: STAFF_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Health news article "${id}" not found.`);
    }
    return row;
  }

  async updateNews(
    id: string,
    dto: UpdateHealthNewsArticleDto,
    staffId: string,
  ) {
    const existing = await this.getNews(id);
    const title =
      dto.title === undefined ? existing.title : (dto.title?.trim() ?? '');
    const body =
      dto.body === undefined ? existing.body : (dto.body?.trim() ?? '');
    const imageUrl =
      dto.imageUrl !== undefined ? dto.imageUrl : existing.imageUrl;
    this.assertHasContent({ title, body, imageUrl });
    const data: Prisma.HealthNewsArticleUpdateInput = {
      updatedBy: { connect: { id: staffId } },
      title,
      body,
      imageUrl,
    };
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && dto.publishedAt === undefined && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    return this.prisma.healthNewsArticle.update({
      where: { id },
      data,
      include: STAFF_INCLUDE,
    });
  }

  async deleteNews(id: string) {
    await this.getNews(id);
    await this.prisma.healthNewsArticle.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─── Patient portal ───────────────────────────────────────────────────────

  async listPublishedCampaigns(query: ListHealthContentQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where = this.publishedWhere();
    const [data, total] = await Promise.all([
      this.prisma.healthCampaign.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          body: true,
          imageUrl: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.healthCampaign.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async listPublishedNews(query: ListHealthContentQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where = this.publishedNewsWhere();
    const [data, total] = await Promise.all([
      this.prisma.healthNewsArticle.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          body: true,
          imageUrl: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.healthNewsArticle.count({ where }),
    ]);
    return { data, total, skip, take };
  }
}
