import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrescriptionItemType,
  PrescriptionRefillRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseFrequency } from '../medication-schedule/rx-schedule.utils';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PrescriptionRefillFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doseGenerator: PatientMedicationDoseGeneratorService,
  ) {}

  async fulfillRefill(
    refillId: string,
    tx?: Tx,
    options?: { quantity?: number },
  ): Promise<void> {
    const client = tx ?? this.prisma;

    const refill = await client.prescriptionRefillRequest.findUnique({
      where: { id: refillId },
      include: {
        prescription: {
          select: {
            id: true,
            refillsAllowed: true,
            endDate: true,
            items: {
              where: { itemType: PrescriptionItemType.DRUG },
              orderBy: { quantityDispensed: 'desc' },
              select: {
                id: true,
                frequency: true,
                quantityDispensed: true,
                quantityPrescribed: true,
              },
            },
          },
        },
        invoiceItem: { select: { quantity: true } },
      },
    });

    if (!refill) {
      throw new NotFoundException(`Refill request "${refillId}" not found.`);
    }

    if (refill.status === PrescriptionRefillRequestStatus.FULFILLED) {
      throw new ConflictException('This refill request is already fulfilled.');
    }

    if (refill.status !== PrescriptionRefillRequestStatus.APPROVED) {
      throw new ConflictException(
        'Only approved refill requests can be fulfilled.',
      );
    }

    const primaryItem = refill.prescription.items[0];
    if (!primaryItem) {
      throw new NotFoundException(
        'Prescription has no drug item to fulfill refill.',
      );
    }

    const quantity =
      options?.quantity ??
      refill.invoiceItem?.quantity ??
      (primaryItem.quantityDispensed > 0
        ? primaryItem.quantityDispensed
        : primaryItem.quantityPrescribed);

    if (quantity <= 0) {
      throw new ConflictException('Fulfillment quantity must be positive.');
    }

    const dosesPerDay = Math.max(
      parseFrequency(primaryItem.frequency).dosesPerDay,
      0.0001,
    );
    const supplyDays = Math.ceil(quantity / dosesPerDay);
    const now = new Date();
    const baseEnd =
      refill.prescription.endDate && refill.prescription.endDate > now
        ? refill.prescription.endDate
        : now;
    const extendedEndDate = new Date(
      baseEnd.getTime() + supplyDays * 24 * 60 * 60 * 1000,
    );

    const prescriptionUpdate: Prisma.PrescriptionUpdateInput = {
      endDate: extendedEndDate,
    };
    if (refill.prescription.refillsAllowed > 0) {
      prescriptionUpdate.refillsAllowed = refill.prescription.refillsAllowed - 1;
    }

    await client.prescriptionItem.update({
      where: { id: primaryItem.id },
      data: {
        quantityDispensed: primaryItem.quantityDispensed + quantity,
      },
    });

    await client.prescription.update({
      where: { id: refill.prescriptionId },
      data: prescriptionUpdate,
    });

    await client.prescriptionRefillRequest.update({
      where: { id: refillId },
      data: { status: PrescriptionRefillRequestStatus.FULFILLED },
    });

    await this.doseGenerator.generateDosesForPrescription(
      refill.prescriptionId,
      client,
    );
  }
}
