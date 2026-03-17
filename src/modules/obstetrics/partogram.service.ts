import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartogramEntryDto } from './dto/create-partogram-entry.dto';

@Injectable()
export class PartogramService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartogramEntryDto) {
    const labourDelivery = await this.prisma.labourDelivery.findUnique({
      where: { id: dto.labourDeliveryId },
    });
    if (!labourDelivery) {
      throw new NotFoundException(
        `Labour/delivery "${dto.labourDeliveryId}" not found.`,
      );
    }
    const recordedBy = await this.prisma.staff.findUnique({
      where: { id: dto.recordedById },
    });
    if (!recordedBy) {
      throw new NotFoundException(`Staff "${dto.recordedById}" not found.`);
    }

    return this.prisma.partogramEntry.create({
      data: {
        labourDeliveryId: dto.labourDeliveryId,
        recordedAt: new Date(dto.recordedAt),
        cervicalDilationCm: dto.cervicalDilationCm ?? null,
        station: dto.station ?? null,
        contractionsPer10Min: dto.contractionsPer10Min ?? null,
        fetalHeartRate: dto.fetalHeartRate ?? null,
        moulding: dto.moulding ?? null,
        descent: dto.descent ?? null,
        oxytocin: dto.oxytocin ?? null,
        comments: dto.comments ?? null,
        recordedById: dto.recordedById,
      },
      include: {
        labourDelivery: { select: { id: true, pregnancyId: true } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByLabourDelivery(labourDeliveryId: string) {
    const delivery = await this.prisma.labourDelivery.findUnique({
      where: { id: labourDeliveryId },
    });
    if (!delivery) {
      throw new NotFoundException(
        `Labour/delivery "${labourDeliveryId}" not found.`,
      );
    }

    return this.prisma.partogramEntry.findMany({
      where: { labourDeliveryId },
      orderBy: { recordedAt: 'asc' },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
