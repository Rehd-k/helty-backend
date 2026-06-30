import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsumableUsageDirection,
  MovementReferenceType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { ConsumableStockService } from './consumable-stock.service';
import { RecordConsumableUsageDto } from './dto/consumable-usage.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class ConsumableUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: ConsumableStockService,
  ) {}

  async recordNonBillableUse(dto: RecordConsumableUsageDto, performedById: string) {
    const consumable = await this.prisma.consumable.findUnique({
      where: { id: dto.consumableId },
    });
    if (!consumable) {
      throw new NotFoundException(`Consumable "${dto.consumableId}" not found.`);
    }
    if (consumable.isBillable) {
      throw new BadRequestException(
        'This consumable is billable; add it to an invoice instead of recording non-billable usage.',
      );
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }

    if (dto.encounterId) {
      const enc = await this.prisma.encounter.findUnique({
        where: { id: dto.encounterId },
        select: { patientId: true },
      });
      if (!enc) {
        throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
      }
      if (enc.patientId !== dto.patientId) {
        throw new BadRequestException('Encounter does not belong to this patient.');
      }
    }

    if (dto.admissionId) {
      const adm = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
        select: { patientId: true },
      });
      if (!adm) {
        throw new NotFoundException(`Admission "${dto.admissionId}" not found.`);
      }
      if (adm.patientId !== dto.patientId) {
        throw new BadRequestException('Admission does not belong to this patient.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.stock.assertStoreLocation(tx, dto.storeLocationId);
      await this.stock.assertEnoughStock(
        tx,
        dto.consumableId,
        dto.storeLocationId,
        dto.quantity,
      );

      const event = await tx.consumableUsageEvent.create({
        data: {
          id: randomUUID(),
          consumableId: dto.consumableId,
          quantity: dto.quantity,
          direction: ConsumableUsageDirection.USE,
          source: dto.source,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          admissionId: dto.admissionId ?? null,
          storeLocationId: dto.storeLocationId,
          performedById,
        },
      });

      await this.stock.applyFifoOut(tx, {
        consumableId: dto.consumableId,
        storeLocationId: dto.storeLocationId,
        quantity: dto.quantity,
        performedById,
        ctx: {
          kind: 'usage',
          usageEventId: event.id,
          referenceId: event.id,
        },
      });

      return tx.consumableUsageEvent.findUniqueOrThrow({
        where: { id: event.id },
        include: {
          consumable: { select: { id: true, name: true, isBillable: true } },
          patient: {
            select: patientNameFieldsSelect,
          },
          encounter: { select: { id: true } },
          admission: { select: { id: true } },
          storeLocation: { select: { id: true, name: true, code: true } },
        },
      });
    });
  }

  async returnNonBillableUse(usageEventId: string, performedById: string) {
    const original = await this.prisma.consumableUsageEvent.findUnique({
      where: { id: usageEventId },
      include: {
        reversals: { select: { id: true, quantity: true } },
      },
    });
    if (!original) {
      throw new NotFoundException(`Usage event "${usageEventId}" not found.`);
    }
    if (original.direction !== ConsumableUsageDirection.USE) {
      throw new BadRequestException('Only a USE event can be returned.');
    }
    const returned = original.reversals.reduce((s, r) => s + r.quantity, 0);
    const remaining = original.quantity - returned;
    if (remaining <= 0) {
      throw new BadRequestException('This usage has already been fully returned.');
    }

    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.consumableUsageEvent.create({
        data: {
          id: randomUUID(),
          consumableId: original.consumableId,
          quantity: remaining,
          direction: ConsumableUsageDirection.RETURN,
          source: original.source,
          patientId: original.patientId,
          encounterId: original.encounterId,
          admissionId: original.admissionId,
          storeLocationId: original.storeLocationId,
          reversalOfId: original.id,
          performedById,
        },
      });

      await this.stock.releaseFifoOutForUsageEvent(tx, original.id, performedById);

      return tx.consumableUsageEvent.findUniqueOrThrow({
        where: { id: ret.id },
        include: {
          consumable: { select: { id: true, name: true } },
          reversalOf: { select: { id: true, quantity: true } },
        },
      });
    });
  }

  async listHistory(query: {
    consumableId?: string;
    patientId?: string;
    encounterId?: string;
    admissionId?: string;
    fromDate?: string;
    toDate?: string;
    skip?: number;
    limit?: number;
  }) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const take = Math.min(Math.max(1, query.limit ?? 50), 200);
    const skip = Math.max(0, query.skip ?? 0);

    const where: Prisma.ConsumableUsageEventWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(query.consumableId && { consumableId: query.consumableId }),
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.encounterId && { encounterId: query.encounterId }),
      ...(query.admissionId && { admissionId: query.admissionId }),
    };

    const [events, movements, total] = await Promise.all([
      this.prisma.consumableUsageEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          consumable: { select: { id: true, name: true, category: true, isBillable: true } },
          patient: {
            select: patientNameFieldsSelect,
          },
          encounter: { select: { id: true, encounterType: true } },
          admission: { select: { id: true } },
          storeLocation: { select: { id: true, name: true, code: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          reversalOf: { select: { id: true, quantity: true, direction: true } },
        },
      }),
      this.prisma.consumableMovement.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          referenceType: {
            in: [
              MovementReferenceType.INVOICE_ITEM,
              MovementReferenceType.CONSUMABLE_USAGE_EVENT,
            ],
          },
          ...(query.consumableId && { consumableId: query.consumableId }),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(take, 100),
        include: {
          batch: {
            select: {
              id: true,
              batchNumber: true,
              consumable: { select: { id: true, name: true, isBillable: true } },
            },
          },
          storeLocation: { select: { id: true, name: true, code: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.consumableUsageEvent.count({ where }),
    ]);

    return { usageEvents: events, stockMovements: movements, total, skip, take };
  }
}
