import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabSampleDto } from './dto/create-lab-sample.dto';

@Injectable()
export class LabSampleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabSampleDto) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { sample: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Lab order item "${dto.orderItemId}" not found.`,
      );
    }
    if (orderItem.sample) {
      throw new ConflictException(
        `Sample already recorded for order item "${dto.orderItemId}".`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.collectedBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.collectedBy}" not found.`);
    }

    return this.prisma.labSample.create({
      data: {
        orderItemId: dto.orderItemId,
        sampleType: dto.sampleType,
        collectedById: dto.collectedBy,
        collectionTime: new Date(dto.collectionTime),
        barcode: dto.barcode,
      },
      include: {
        orderItem: {
          include: {
            testVersion: {
              include: { test: { select: { id: true, name: true } } },
            },
          },
        },
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
