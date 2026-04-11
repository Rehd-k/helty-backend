import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import * as path from 'path';
import * as fs from 'fs';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads', 'radiology');

@Injectable()
export class RadiologyImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async upload(
    orderItemId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    const staff = await this.prisma.staff.findUnique({
      where: { id: uploadedById },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${uploadedById}" not found.`);
    }
    const filePath = (file as Express.Multer.File & { path?: string }).path;
    if (!file || !filePath) {
      throw new NotFoundException('No file in request.');
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const relativePath = path.relative(uploadsRoot, filePath);
    const normalizedPath = relativePath.split(path.sep).join('/');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.radiologyImage.create({
        data: {
          radiologyOrderItemId: orderItemId,
          fileName: file.originalname || path.basename(filePath),
          filePath: normalizedPath,
          mimeType: file.mimetype || null,
          fileSize: file.size || null,
          uploadedById,
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await this.invoiceService.settleInvoiceItemIfPresent(
        tx,
        orderItem.invoiceItemId,
      );
      return created;
    });
  }

  async listByOrderItemId(orderItemId: string) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    return this.prisma.radiologyImage.findMany({
      where: { radiologyOrderItemId: orderItemId },
      orderBy: { uploadedAt: 'asc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getFile(
    id: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string | null }> {
    const image = await this.prisma.radiologyImage.findUnique({
      where: { id },
    });
    if (!image) {
      throw new NotFoundException(`Radiology image "${id}" not found.`);
    }
    const absolutePath = path.join(process.cwd(), 'uploads', image.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk.');
    }
    return {
      filePath: absolutePath,
      fileName: image.fileName,
      mimeType: image.mimeType,
    };
  }

  async remove(id: string) {
    const image = await this.prisma.radiologyImage.findUnique({
      where: { id },
    });
    if (!image) {
      throw new NotFoundException(`Radiology image "${id}" not found.`);
    }
    const absolutePath = path.join(process.cwd(), 'uploads', image.filePath);
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch {
        // ignore if file already missing
      }
    }
    await this.prisma.radiologyImage.delete({ where: { id } });
    return { message: 'Image deleted.' };
  }

  static getUploadBase(): string {
    return UPLOAD_BASE;
  }
}
