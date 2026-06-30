import {
  AdmissionStatus,
  EncounterType,
  InvoicePaymentMethod,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import {
  asInvoiceDecimal,
  computeRecurringDays,
  decimalBalance,
  formatDecimalAmount,
  invoiceLineTotal,
} from '../../common/utils/invoice-line-total.util';
import {
  CHARGE_CATEGORY_LABELS,
  CHARGE_CATEGORY_ORDER,
  PATIENT_BILLING_CURRENCY,
  PATIENT_BILLING_DUE_DAYS,
  PatientBillType,
  PatientChargeCategory,
} from './patient-billing.constants';
import {
  BillingSummaryResponseDto,
} from './dto/billing-summary-response.dto';
import {
  BreakdownCategoryDto,
  BreakdownLineItemDto,
  InvoiceDetailDto,
  InvoicePaymentSummaryDto,
  PatientAdmissionSummaryDto,
} from './dto/invoice-detail.dto';
import { InvoiceSummaryDto } from './dto/invoice-summary.dto';
import {
  PaymentHistoryItemDto,
  ReceiptResponseDto,
} from './dto/payment-summary.dto';

type InvoiceItemRow = {
  id: string;
  customDescription: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  isRecurringDaily: boolean;
  drugId: string | null;
  consumableId: string | null;
  purchaseItemId: string | null;
  service: {
    name: string;
    category: { name: string } | null;
  } | null;
  drug: { brandName: string; genericName: string; strength: string | null } | null;
  consumable: { name: string } | null;
  purchaseItem: { itemName: string } | null;
  usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
};

type EncounterRow = {
  encounterType: EncounterType;
  admissionId: string | null;
  admission: {
    id: string;
    status: AdmissionStatus;
    admissionDate: Date;
    admissionDateTime: Date;
    dischargeDate: Date | null;
    dischargeDateTime: Date | null;
    ward: string | null;
    wardEntity: { name: string } | null;
  } | null;
} | null;

export type InvoiceListRow = {
  id: string;
  invoiceID: string;
  status: InvoiceStatus;
  totalAmount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  createdAt: Date;
  encounter: EncounterRow;
  invoiceItems: InvoiceItemRow[];
};

export type InvoiceDetailRow = InvoiceListRow & {
  payments: Array<{
    id: string;
    amount: Prisma.Decimal;
    method: InvoicePaymentMethod | null;
    reference: string | null;
    paidAt: Date;
  }>;
};

export function deriveBillType(encounter: EncounterRow): PatientBillType {
  if (!encounter) return PatientBillType.OUTPATIENT;
  if (
    encounter.admissionId ||
    encounter.encounterType === EncounterType.INPATIENT_REVIEW
  ) {
    return PatientBillType.INPATIENT;
  }
  return PatientBillType.OUTPATIENT;
}

export function drugDisplayName(
  drug: { brandName: string; genericName: string; strength: string | null } | null,
): string | null {
  if (!drug) return null;
  const brand = drug.brandName?.trim();
  const generic = drug.genericName?.trim();
  const strength = drug.strength?.trim();
  const base = brand || generic;
  if (!base) return null;
  return strength ? `${base} ${strength}` : base;
}

export function lineItemDescription(item: InvoiceItemRow): string {
  const custom = item.customDescription?.trim();
  if (custom) return custom;
  const purchase = item.purchaseItem?.itemName?.trim();
  if (purchase) return purchase;
  const consumable = item.consumable?.name?.trim();
  if (consumable) return consumable;
  const drug = drugDisplayName(item.drug);
  if (drug) return drug;
  const service = item.service?.name?.trim();
  if (service) return service;
  return 'Charge';
}

export function deriveInvoiceTitle(
  invoice: Pick<InvoiceListRow, 'invoiceItems' | 'encounter'>,
): string {
  const firstItem = invoice.invoiceItems[0];
  if (firstItem) {
    const desc = lineItemDescription(firstItem);
    if (desc !== 'Charge') return desc;
  }

  const admission = invoice.encounter?.admission;
  if (admission) {
    const wardName =
      admission.wardEntity?.name?.trim() ||
      admission.ward?.trim() ||
      null;
    if (wardName) return `Inpatient Stay — ${wardName}`;
  }

  return 'Hospital Bill';
}

export function chargeCategoryForItem(item: InvoiceItemRow): PatientChargeCategory {
  if (item.isRecurringDaily) return PatientChargeCategory.DAILY;
  if (item.drugId || item.consumableId) return PatientChargeCategory.PHARMACY;
  if (item.purchaseItemId) return PatientChargeCategory.SUPPLIES;

  const categoryName = (item.service?.category?.name ?? '').trim().toLowerCase();
  if (
    categoryName === 'laboratory tests' ||
    categoryName === 'laboratory' ||
    categoryName === 'radiology & imaging'
  ) {
    return PatientChargeCategory.LAB;
  }

  return PatientChargeCategory.OTHER;
}

function formatCurrencyNaira(amount: Prisma.Decimal | number | string): string {
  const value = Number(formatDecimalAmount(amount));
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildUsageSummary(
  item: InvoiceItemRow,
  billableDays: number,
  now: Date,
): string | null {
  if (!item.isRecurringDaily || billableDays <= 0) return null;
  const unitPrice = formatCurrencyNaira(item.unitPrice);
  return `${billableDays} day${billableDays === 1 ? '' : 's'} @ ${unitPrice}/day`;
}

export function toBreakdownLineItem(
  item: InvoiceItemRow,
  now: Date = new Date(),
): BreakdownLineItemDto {
  const lineTotal = invoiceLineTotal(item, now);
  const billableDays = item.isRecurringDaily
    ? computeRecurringDays(item.usageSegments, now)
    : null;

  return {
    id: item.id,
    description: lineItemDescription(item),
    unitPrice: formatDecimalAmount(item.unitPrice),
    quantity: item.quantity,
    lineTotal: formatDecimalAmount(lineTotal),
    amountPaid: formatDecimalAmount(item.amountPaid),
    balance: formatDecimalAmount(decimalBalance(lineTotal, item.amountPaid)),
    isRecurringDaily: item.isRecurringDaily,
    billableDays,
    usageSummary: billableDays != null
      ? buildUsageSummary(item, billableDays, now)
      : null,
  };
}

export function buildBreakdown(
  items: InvoiceItemRow[],
  now: Date = new Date(),
): BreakdownCategoryDto[] {
  const grouped = new Map<PatientChargeCategory, BreakdownLineItemDto[]>();

  for (const item of items) {
    const category = chargeCategoryForItem(item);
    const line = toBreakdownLineItem(item, now);
    const list = grouped.get(category) ?? [];
    list.push(line);
    grouped.set(category, list);
  }

  return CHARGE_CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map(
    (category) => {
      const categoryItems = grouped.get(category)!;
      const subtotal = categoryItems.reduce(
        (sum, line) => sum.add(asInvoiceDecimal(line.lineTotal)),
        new Prisma.Decimal(0),
      );
      const amountPaid = categoryItems.reduce(
        (sum, line) => sum.add(asInvoiceDecimal(line.amountPaid)),
        new Prisma.Decimal(0),
      );

      return {
        category,
        label: CHARGE_CATEGORY_LABELS[category],
        subtotal: formatDecimalAmount(subtotal),
        amountPaid: formatDecimalAmount(amountPaid),
        balance: formatDecimalAmount(decimalBalance(subtotal, amountPaid)),
        items: categoryItems,
      };
    },
  );
}

function toAdmissionSummary(
  encounter: EncounterRow,
): PatientAdmissionSummaryDto | null {
  const admission = encounter?.admission;
  if (!admission) return null;

  return {
    id: admission.id,
    wardName:
      admission.wardEntity?.name?.trim() ||
      admission.ward?.trim() ||
      'Ward',
    admittedAt: admission.admissionDateTime ?? admission.admissionDate,
    dischargedAt: admission.dischargeDateTime ?? admission.dischargeDate,
    status: admission.status,
  };
}

export function paymentMethodLabel(
  method: InvoicePaymentMethod | null | undefined,
): string {
  switch (method) {
    case InvoicePaymentMethod.CASH:
      return 'Cash';
    case InvoicePaymentMethod.CARD:
      return 'Card';
    case InvoicePaymentMethod.TRANSFER:
      return 'Bank Transfer';
    case InvoicePaymentMethod.INSURANCE:
      return 'Insurance';
    case InvoicePaymentMethod.WAIVER:
      return 'Waiver';
    default:
      return 'Payment';
  }
}

export function maskPaymentReference(
  reference: string | null | undefined,
  method: InvoicePaymentMethod | null | undefined,
): string | null {
  if (!reference?.trim()) return null;
  const trimmed = reference.trim();
  if (trimmed.length <= 4) return trimmed;
  const last4 = trimmed.slice(-4);
  if (method === InvoicePaymentMethod.CARD) {
    return `**** ${last4}`;
  }
  return trimmed;
}

export function paymentMethodDetail(
  method: InvoicePaymentMethod | null | undefined,
  reference: string | null | undefined,
): string {
  const label = paymentMethodLabel(method);
  const masked = maskPaymentReference(reference, method);
  if (method === InvoicePaymentMethod.CARD && masked) {
    return `Card ID: ${masked}`;
  }
  if (masked && masked !== reference?.trim()) {
    return `${label} — ${masked}`;
  }
  return label;
}

function toPaymentSummary(
  payment: InvoiceDetailRow['payments'][number],
): InvoicePaymentSummaryDto {
  return {
    id: payment.id,
    amount: formatDecimalAmount(payment.amount),
    method: payment.method,
    methodLabel: paymentMethodLabel(payment.method),
    paidAt: payment.paidAt,
    reference: maskPaymentReference(payment.reference, payment.method),
  };
}

export function toInvoiceSummaryDto(invoice: InvoiceListRow): InvoiceSummaryDto {
  const billType = deriveBillType(invoice.encounter);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceID,
    title: deriveInvoiceTitle(invoice),
    billType,
    status: invoice.status,
    issuedAt: invoice.createdAt,
    totalAmount: formatDecimalAmount(invoice.totalAmount),
    amountPaid: formatDecimalAmount(invoice.amountPaid),
    balance: formatDecimalAmount(
      decimalBalance(invoice.totalAmount, invoice.amountPaid),
    ),
  };
}

export function toInvoiceDetailDto(
  invoice: InvoiceDetailRow,
  now: Date = new Date(),
): InvoiceDetailDto {
  const billType = deriveBillType(invoice.encounter);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceID,
    billType,
    status: invoice.status,
    issuedAt: invoice.createdAt,
    totalAmount: formatDecimalAmount(invoice.totalAmount),
    amountPaid: formatDecimalAmount(invoice.amountPaid),
    balance: formatDecimalAmount(
      decimalBalance(invoice.totalAmount, invoice.amountPaid),
    ),
    admission:
      billType === PatientBillType.INPATIENT
        ? toAdmissionSummary(invoice.encounter)
        : null,
    breakdown: buildBreakdown(invoice.invoiceItems, now),
    payments: invoice.payments.map(toPaymentSummary),
  };
}

export function toPaymentHistoryItemDto(
  payment: {
    id: string;
    amount: Prisma.Decimal;
    method: InvoicePaymentMethod | null;
    reference: string | null;
    paidAt: Date;
    invoice: {
      id: string;
      invoiceID: string;
      encounter: EncounterRow;
      invoiceItems: InvoiceItemRow[];
    };
  },
): PaymentHistoryItemDto {
  return {
    id: payment.id,
    invoiceId: payment.invoice.id,
    invoiceNumber: payment.invoice.invoiceID,
    description: deriveInvoiceTitle(payment.invoice),
    amount: formatDecimalAmount(payment.amount),
    method: payment.method,
    methodLabel: paymentMethodLabel(payment.method),
    methodDetail: paymentMethodDetail(payment.method, payment.reference),
    paidAt: payment.paidAt,
    status: 'SUCCESS',
  };
}

export function toReceiptResponseDto(
  payment: {
    id: string;
    amount: Prisma.Decimal;
    method: InvoicePaymentMethod | null;
    paidAt: Date;
    invoice: { invoiceID: string };
  },
): ReceiptResponseDto {
  return {
    id: payment.id,
    invoiceNumber: payment.invoice.invoiceID,
    amount: formatDecimalAmount(payment.amount),
    paidAt: payment.paidAt,
    method: payment.method,
    methodLabel: paymentMethodLabel(payment.method),
    url: null,
  };
}

export function buildBillingSummary(
  unpaidInvoices: Array<{
    totalAmount: Prisma.Decimal;
    amountPaid: Prisma.Decimal;
    createdAt: Date;
  }>,
  now: Date = new Date(),
): BillingSummaryResponseDto {
  let totalOutstanding = new Prisma.Decimal(0);
  let unpaidInvoiceCount = 0;
  let earliestCreated: Date | null = null;

  for (const invoice of unpaidInvoices) {
    const balance = decimalBalance(invoice.totalAmount, invoice.amountPaid);
    if (balance.lte(0)) continue;
    unpaidInvoiceCount += 1;
    totalOutstanding = totalOutstanding.add(balance);
    if (!earliestCreated || invoice.createdAt < earliestCreated) {
      earliestCreated = invoice.createdAt;
    }
  }

  let nextDueDate: Date | null = null;
  let daysUntilDue = 0;

  if (earliestCreated) {
    nextDueDate = new Date(earliestCreated);
    nextDueDate.setDate(nextDueDate.getDate() + PATIENT_BILLING_DUE_DAYS);
    const msUntilDue = nextDueDate.getTime() - now.getTime();
    daysUntilDue = Math.max(0, Math.ceil(msUntilDue / (24 * 60 * 60 * 1000)));
  }

  return {
    totalOutstanding: formatDecimalAmount(totalOutstanding),
    unpaidInvoiceCount,
    nextDueDate,
    daysUntilDue,
    currency: PATIENT_BILLING_CURRENCY,
  };
}
