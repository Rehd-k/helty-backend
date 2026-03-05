import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StockTransferStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';
import { ListStockTransferDto } from './dto/list-stock-transfer.dto';

const ALLOWED_SORT = new Set(['createdAt', 'status', 'completedAt']);

@Injectable()
export class PharmacyStockTransferService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockTransferDto, createdById: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('From and to locations must be different.');
    }
    const [fromLoc, toLoc] = await Promise.all([
      this.prisma.pharmacyLocation.findUnique({ where: { id: dto.fromLocationId } }),
      this.prisma.pharmacyLocation.findUnique({ where: { id: dto.toLocationId } }),
    ]);
    if (!fromLoc) throw new NotFoundException(`From location "${dto.fromLocationId}" not found.`);
    if (!toLoc) throw new NotFoundException(`To location "${dto.toLocationId}" not found.`);

    if (!dto.items?.length) {
      throw new BadRequestException('At least one transfer item is required.');
    }

    for (const item of dto.items) {
      const batch = await this.prisma.drugBatch.findUnique({
        where: { id: item.batchId },
      });
      if (!batch) {
        throw new NotFoundException(`Batch "${item.batchId}" not found.`);
      }
      if (batch.toLocationId !== dto.fromLocationId) {
        throw new BadRequestException(
          `Batch "${item.batchId}" is not at the selected from-location.`,
        );
      }
      if (batch.quantityRemaining < item.quantity) {
        throw new BadRequestException(
          `Insufficient quantity for batch "${item.batchId}". Available: ${batch.quantityRemaining}.`,
        );
      }
    }

    return this.prisma.stockTransfer.create({
      data: {
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        createdById,
        status: 'PENDING',
        items: {
          create: dto.items.map((i) => ({
            batchId: i.batchId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        fromLocation: true,
        toLocation: true,
        items: { include: { batch: { include: { drug: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListStockTransferDto) {
    const { status, fromLocationId, toLocationId, sortBy, sortOrder = 'desc', skip = 0, limit = 20 } = query;
    const take = Math.min(Math.max(1, limit), 100);
    const where: Prisma.StockTransferWhereInput = {};

    if (status) where.status = status;
    if (fromLocationId) where.fromLocationId = fromLocationId;
    if (toLocationId) where.toLocationId = toLocationId;

    const orderBy = ALLOWED_SORT.has(sortBy ?? '')
      ? { [sortBy!]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        orderBy,
        skip: Math.max(0, skip),
        take,
        include: {
          fromLocation: { select: { id: true, name: true, locationType: true } },
          toLocation: { select: { id: true, name: true, locationType: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromLocation: true,
        toLocation: true,
        items: { include: { batch: { include: { drug: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!transfer) {
      throw new NotFoundException(`Stock transfer "${id}" not found.`);
    }
    return transfer;
  }

  async approve(id: string, approvedById: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Only pending transfers can be approved.');
    }
    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: 'APPROVED', approvedById },
      include: {
        fromLocation: true,
        toLocation: true,
        items: { include: { batch: { include: { drug: true } } } },
      },
    });
  }

  async complete(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'APPROVED') {
      throw new BadRequestException('Only approved transfers can be completed.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const batch = await tx.drugBatch.findUnique({ where: { id: item.batchId } });
        if (!batch || batch.quantityRemaining < item.quantity) {
          throw new BadRequestException(
            `Insufficient quantity for batch "${item.batchId}" to complete transfer.`,
          );
        }
        await tx.drugBatch.update({
          where: { id: item.batchId },
          data: { quantityRemaining: batch.quantityRemaining - item.quantity },
        });
        await tx.drugBatch.create({
          data: {
            drugId: batch.drugId,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            batchNumber: batch.batchNumber,
            manufacturingDate: batch.manufacturingDate,
            expiryDate: batch.expiryDate,
            supplierId: batch.supplierId,
            costPrice: batch.costPrice,
            sellingPrice: batch.sellingPrice,
            quantityReceived: item.quantity,
            quantityRemaining: item.quantity,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: {
          fromLocation: true,
          toLocation: true,
          items: { include: { batch: { include: { drug: true } } } },
        },
      });
    });
  }
}
