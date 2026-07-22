import { Prisma } from '@prisma/client';
import { formatPatientDisplayName } from '../../common/utils/patient-display-name.util';
import { PharmacyRefillRequestRow } from './pharmacy.refill-request.includes';

function decimalToString(value: Prisma.Decimal | number | string): string {
  return value instanceof Prisma.Decimal ? value.toFixed(2) : String(value);
}

export function toPharmacyRefillRequestDto(row: PharmacyRefillRequestRow) {
  return {
    id: row.id,
    status: row.status,
    notes: row.notes,
    pharmacyNotes: row.pharmacyNotes,
    createdAt: row.createdAt,
    patient: {
      id: row.patient.id,
      patientId: row.patient.patientId,
      surname: row.patient.surname,
      otherName: row.patient.otherName,
      firstName: row.patient.firstName,
      displayName: formatPatientDisplayName(row.patient),
      avatarUrl: row.patient.avatarUrl ?? null,
    },
    prescription: {
      id: row.prescription.id,
      drug: row.prescription.drug,
      dosage: row.prescription.dosage,
      startDate: row.prescription.startDate,
      endDate: row.prescription.endDate,
      refillsAllowed: row.prescription.refillsAllowed,
      doctor: row.prescription.doctor,
      items: row.prescription.items.map((item) => ({
        id: item.id,
        dosage: item.dosage,
        frequency: item.frequency,
        quantityDispensed: item.quantityDispensed,
        quantityPrescribed: item.quantityPrescribed,
        instructions: item.instructions,
        drug: item.drug,
      })),
    },
    invoiceItem: row.invoiceItem
      ? {
          id: row.invoiceItem.id,
          invoiceId: row.invoiceItem.invoiceId,
          quantity: row.invoiceItem.quantity,
          settled: row.invoiceItem.settled,
          invoice: { status: row.invoiceItem.invoice.status },
        }
      : null,
  };
}

export function toBillPharmacyRefillResponse(
  refill: PharmacyRefillRequestRow,
  invoice: {
    id: string;
    invoiceID: string;
    status: string;
    totalAmount: Prisma.Decimal;
  },
  invoiceItem: {
    id: string;
    drugId: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    settled: boolean;
  },
) {
  return {
    refillRequest: {
      id: refill.id,
      status: refill.status,
      invoiceItemId: refill.invoiceItemId,
    },
    invoice: {
      id: invoice.id,
      invoiceID: invoice.invoiceID,
      status: invoice.status,
      totalAmount: decimalToString(invoice.totalAmount),
    },
    invoiceItem: {
      id: invoiceItem.id,
      drugId: invoiceItem.drugId,
      quantity: invoiceItem.quantity,
      unitPrice: decimalToString(invoiceItem.unitPrice),
      settled: invoiceItem.settled,
    },
  };
}

export function resolvePrimaryDrugItem(row: PharmacyRefillRequestRow) {
  return row.prescription.items.find((item) => item.drugId != null) ?? null;
}

export function resolveDefaultBillQuantity(row: PharmacyRefillRequestRow): number {
  const item = resolvePrimaryDrugItem(row);
  if (!item) return 0;
  return item.quantityDispensed > 0
    ? item.quantityDispensed
    : item.quantityPrescribed;
}
