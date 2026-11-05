import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDisplayVideoDto } from './dto/display-video.dto';

const VIDEO_SELECT = {
  id: true,
  title: true,
  fileName: true,
  mimeType: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class DisplayVideoService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveFor(user?: { sub?: string; accountType?: string }) {
    if (user?.accountType === 'DISPLAY') {
      await this.assertActiveDisplay(user.sub);
    }
    return this.listActive();
  }

  async listActive() {
    return this.prisma.displayVideo.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: VIDEO_SELECT,
    });
  }

  async listAll() {
    return this.prisma.displayVideo.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: VIDEO_SELECT,
    });
  }

  async upload(file: Express.Multer.File | undefined, title: string | undefined, staffId: string) {
    await this.assertActiveStaff(staffId);
    if (!file) {
      throw new BadRequestException('Video file is required');
    }
    const cleanTitle = title?.trim() || path.parse(file.originalname).name || 'Video';
    const last = await this.prisma.displayVideo.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.displayVideo.create({
      data: {
        title: cleanTitle,
        fileName: file.originalname || file.filename,
        filePath: file.path,
        mimeType: file.mimetype || 'video/mp4',
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdBy: { connect: { id: staffId } },
      },
      select: VIDEO_SELECT,
    });
  }

  async update(id: string, dto: UpdateDisplayVideoDto) {
    await this.requireVideo(id);
    const title = dto.title?.trim();
    return this.prisma.displayVideo.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
      select: VIDEO_SELECT,
    });
  }

  async reorder(orderedIds: string[]) {
    const unique = [...new Set(orderedIds.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) {
      throw new BadRequestException('orderedIds is required');
    }
    await this.prisma.$transaction(
      unique.map((id, index) =>
        this.prisma.displayVideo.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listAll();
  }

  async remove(id: string) {
    const video = await this.requireVideo(id);
    await this.prisma.displayVideo.delete({ where: { id } });
    await fs.promises.unlink(video.filePath).catch(() => undefined);
  }

  async fileFor(id: string, user?: { sub?: string; accountType?: string }) {
    if (user?.accountType === 'DISPLAY') {
      await this.assertActiveDisplay(user.sub);
    }
    const video = await this.requireVideo(id);
    if (user?.accountType === 'DISPLAY' && !video.isActive) {
      throw new NotFoundException('Video not found');
    }
    if (!fs.existsSync(video.filePath)) {
      throw new NotFoundException('Video file is missing');
    }
    return video;
  }

  private async requireVideo(id: string) {
    const video = await this.prisma.displayVideo.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }

  private async assertActiveDisplay(staffId?: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId ?? '' },
      select: { isActive: true, accountType: true },
    });
    if (!staff || staff.accountType !== 'DISPLAY') {
      throw new ForbiddenException('Access denied');
    }
    if (!staff.isActive) {
      throw new UnauthorizedException('Display account is inactive');
    }
  }

  private async assertActiveStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { isActive: true },
    });
    if (!staff?.isActive) {
      throw new UnauthorizedException('Staff account is inactive');
    }
  }
}
