import { Injectable } from '@nestjs/common';
import {
  MedicationAdministrationLifecycleStatus,
  MedicationRequestStatus,
  PrescriptionItemType,
  PrescriptionStatus,
  PrescriptionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDuration,
  parseDuration,
} from '../medication-schedule/rx-schedule.utils';

const DISPENSED_ORDER_INCLUDE = {
  medicationRequests: {
    include: {
      invoiceItem: { select: { quantity: true } },
    },
  },
  drug: { select: { brandName: true, genericName: true, strength: true } },
} satisfies Prisma.MedicationOrderInclude;

type DispensedOrderRow = Prisma.MedicationOrderGetPayload<{
  include: typeof DISPENSED_ORDER_INCLUDE;
}>;

@Injectable()
export class MedicationOrderPrescriptionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncDispensedOutpatientOrdersForPatient(patientId: string): Promise<void> {
    const orders = await this.prisma.medicationOrder.findMany({
      where: {
        patientId,
        admissionId: null,
        status: 'Dispensed',
        administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
        drugId: { not: null },
      },
      include: DISPENSED_ORDER_INCLUDE,
    });

    for (const order of orders) {
      await this.syncOrderIfNeeded(order);
    }
  }

  async syncDispensedOrder(
    medicationOrderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const order = await client.medicationOrder.findUnique({
      where: { id: medicationOrderId },
      include: DISPENSED_ORDER_INCLUDE,
    });

    if (
      !order ||
      order.admissionId != null ||
      order.status !== 'Dispensed' ||
      order.administrationStatus !==
        MedicationAdministrationLifecycleStatus.ACTIVE ||
      !order.drugId
    ) {
      return;
    }

    await this.syncOrderIfNeeded(order, client);
  }

  private async syncOrderIfNeeded(
    order: DispensedOrderRow,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const existing = await client.prescription.findFirst({
      where: {
        patientId: order.patientId,
        encounterId: order.encounterId,
        items: { some: { drugId: order.drugId! } },
      },
      select: { id: true },
    });
    if (existing) return;

    const quantityDispensed = this.sumDispensedQuantity(order);
    if (quantityDispensed <= 0) return;

    const startDate = this.resolveStartDate(order);
    const endDate = this.resolveEndDate(order, startDate);
    const parsedDuration = parseDuration(order.duration);
    const dosage =
      order.dose?.trim() ||
      order.drug?.strength?.trim() ||
      order.drug?.brandName ||
      order.drugName;

    await client.prescription.create({
      data: {
        patientId: order.patientId,
        encounterId: order.encounterId,
        doctorId: order.doctorId,
        type: PrescriptionType.OUTPATIENT,
        status: PrescriptionStatus.COMPLETED,
        drug: order.drugName,
        dosage,
        startDate,
        endDate,
        notes: order.notes,
        createdById: order.doctorId,
        items: {
          create: {
            itemType: PrescriptionItemType.DRUG,
            drugId: order.drugId!,
            dosage,
            frequency: order.frequency,
            duration: parsedDuration?.durationValue ?? null,
            quantityPrescribed: this.sumRequestedQuantity(order),
            quantityDispensed,
            instructions: order.specialInstructions,
          },
        },
      },
    });
  }

  private sumDispensedQuantity(order: DispensedOrderRow): number {
    return order.medicationRequests
      .filter((request) => request.status === MedicationRequestStatus.DISPENSED)
      .reduce((sum, request) => {
        const qty = request.invoiceItem?.quantity ?? request.requestedQuantity;
        return sum + qty;
      }, 0);
  }

  private sumRequestedQuantity(order: DispensedOrderRow): number {
    return order.medicationRequests.reduce(
      (sum, request) => sum + request.requestedQuantity,
      0,
    );
  }

  private resolveStartDate(order: DispensedOrderRow): Date {
    if (order.startDateTime) return order.startDateTime;

    const billedAt = order.medicationRequests
      .map((request) => request.billedAt)
      .filter((value): value is Date => value != null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return billedAt ?? order.createdAt ?? new Date();
  }

  private resolveEndDate(order: DispensedOrderRow, startDate: Date): Date | null {
    if (order.endDateTime) return order.endDateTime;

    const parsed = parseDuration(order.duration);
    if (!parsed) return null;

    return addDuration(startDate, parsed.durationValue, parsed.durationUnit);
  }
}
