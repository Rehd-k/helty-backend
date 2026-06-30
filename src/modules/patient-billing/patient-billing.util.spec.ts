import { Prisma } from '@prisma/client';
import {
  computeRecurringDays,
  decimalBalance,
  formatDecimalAmount,
  invoiceLineTotal,
} from '../../common/utils/invoice-line-total.util';
import { PatientBillType, PatientChargeCategory } from './patient-billing.constants';
import {
  buildBillingSummary,
  buildBreakdown,
  chargeCategoryForItem,
  deriveBillType,
  deriveInvoiceTitle,
  lineItemDescription,
  maskPaymentReference,
  paymentMethodDetail,
  paymentMethodLabel,
  toBreakdownLineItem,
  toInvoiceSummaryDto,
} from './patient-billing.util';
import { EncounterType, InvoicePaymentMethod, InvoiceStatus } from '@prisma/client';

describe('invoice-line-total.util', () => {
  const now = new Date('2026-06-28T12:00:00.000Z');

  it('computes recurring days with floor for open segment', () => {
    const start = new Date('2026-06-28T10:00:00.000Z');
    expect(computeRecurringDays([{ startAt: start, endAt: null }], now)).toBe(0);
  });

  it('computes recurring days with ceil for closed same-day segment', () => {
    const start = new Date('2026-06-28T08:00:00.000Z');
    const end = new Date('2026-06-28T18:00:00.000Z');
    expect(computeRecurringDays([{ startAt: start, endAt: end }], now)).toBe(1);
  });

  it('computes line total for quantity-based item', () => {
    const total = invoiceLineTotal(
      {
        unitPrice: new Prisma.Decimal('2500.00'),
        quantity: 4,
        isRecurringDaily: false,
        usageSegments: [],
      },
      now,
    );
    expect(formatDecimalAmount(total)).toBe('10000.00');
  });

  it('computes line total for recurring daily item', () => {
    const total = invoiceLineTotal(
      {
        unitPrice: new Prisma.Decimal('15000.00'),
        quantity: 1,
        isRecurringDaily: true,
        usageSegments: [
          {
            startAt: new Date('2026-06-25T08:00:00.000Z'),
            endAt: new Date('2026-06-28T08:00:00.000Z'),
          },
        ],
      },
      now,
    );
    expect(Number(formatDecimalAmount(total))).toBeGreaterThan(0);
  });
});

describe('patient-billing.util', () => {
  const now = new Date('2026-06-28T12:00:00.000Z');

  const baseItem = {
    id: 'item-1',
    customDescription: null as string | null,
    quantity: 2,
    unitPrice: new Prisma.Decimal('5000.00'),
    amountPaid: new Prisma.Decimal('3000.00'),
    isRecurringDaily: false,
    drugId: null as string | null,
    consumableId: null as string | null,
    purchaseItemId: null as string | null,
    service: { name: 'Consultation', category: { name: 'Consultation' } },
    drug: null as { brandName: string; genericName: string; strength: string | null } | null,
    consumable: null,
    purchaseItem: null as { itemName: string } | null,
    usageSegments: [] as Array<{ startAt: Date; endAt: Date | null }>,
  };

  describe('chargeCategoryForItem', () => {
    it('maps recurring daily to DAILY', () => {
      expect(
        chargeCategoryForItem({ ...baseItem, isRecurringDaily: true }),
      ).toBe(PatientChargeCategory.DAILY);
    });

    it('maps drug lines to PHARMACY', () => {
      expect(
        chargeCategoryForItem({
          ...baseItem,
          drugId: 'drug-1',
          drug: { brandName: 'Amoxicillin', genericName: 'Amoxicillin', strength: '500mg' },
          service: null,
        }),
      ).toBe(PatientChargeCategory.PHARMACY);
    });

    it('maps laboratory service to LAB', () => {
      expect(
        chargeCategoryForItem({
          ...baseItem,
          service: {
            name: 'FBC',
            category: { name: 'Laboratory Tests' },
          },
        }),
      ).toBe(PatientChargeCategory.LAB);
    });

    it('maps purchase item to SUPPLIES', () => {
      expect(
        chargeCategoryForItem({
          ...baseItem,
          purchaseItemId: 'pi-1',
          purchaseItem: { itemName: 'Gloves' },
          service: null,
        }),
      ).toBe(PatientChargeCategory.SUPPLIES);
    });

    it('maps other services to OTHER', () => {
      expect(chargeCategoryForItem(baseItem)).toBe(PatientChargeCategory.OTHER);
    });
  });

  describe('deriveBillType', () => {
    it('returns INPATIENT when admission is linked', () => {
      expect(
        deriveBillType({
          encounterType: EncounterType.OUTPATIENT,
          admissionId: 'adm-1',
          admission: null,
        }),
      ).toBe(PatientBillType.INPATIENT);
    });

    it('returns OUTPATIENT for regular encounter', () => {
      expect(
        deriveBillType({
          encounterType: EncounterType.OUTPATIENT,
          admissionId: null,
          admission: null,
        }),
      ).toBe(PatientBillType.OUTPATIENT);
    });
  });

  describe('deriveInvoiceTitle', () => {
    it('uses first line item service name', () => {
      expect(
        deriveInvoiceTitle({
          invoiceItems: [baseItem],
          encounter: null,
        }),
      ).toBe('Consultation');
    });

    it('uses inpatient ward fallback', () => {
      expect(
        deriveInvoiceTitle({
          invoiceItems: [],
          encounter: {
            encounterType: EncounterType.INPATIENT_REVIEW,
            admissionId: 'adm-1',
            admission: {
              id: 'adm-1',
              status: 'ACTIVE' as const,
              admissionDate: new Date(),
              admissionDateTime: new Date(),
              dischargeDate: null,
              dischargeDateTime: null,
              ward: null,
              wardEntity: { name: 'Cardiology Ward' },
            },
          },
        }),
      ).toBe('Inpatient Stay — Cardiology Ward');
    });
  });

  describe('buildBreakdown', () => {
    it('groups items by category with subtotals', () => {
      const breakdown = buildBreakdown(
        [
          baseItem,
          {
            ...baseItem,
            id: 'item-2',
            drugId: 'drug-1',
            drug: { brandName: 'Drug A', genericName: 'Drug A', strength: null },
            service: null,
            unitPrice: new Prisma.Decimal('1000.00'),
            quantity: 1,
            amountPaid: new Prisma.Decimal('0.00'),
          },
        ],
        now,
      );

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].category).toBe(PatientChargeCategory.PHARMACY);
      expect(breakdown[1].category).toBe(PatientChargeCategory.OTHER);
      expect(breakdown[1].items).toHaveLength(1);
    });
  });

  describe('toBreakdownLineItem', () => {
    it('includes usage summary for recurring daily lines', () => {
      const line = toBreakdownLineItem(
        {
          ...baseItem,
          isRecurringDaily: true,
          unitPrice: new Prisma.Decimal('15000.00'),
          usageSegments: [
            {
              startAt: new Date('2026-06-25T08:00:00.000Z'),
              endAt: new Date('2026-06-28T08:00:00.000Z'),
            },
          ],
        },
        now,
      );

      expect(line.isRecurringDaily).toBe(true);
      expect(line.billableDays).toBeGreaterThan(0);
      expect(line.usageSummary).toContain('day');
    });
  });

  describe('buildBillingSummary', () => {
    it('aggregates outstanding balance and due date', () => {
      const summary = buildBillingSummary(
        [
          {
            totalAmount: new Prisma.Decimal('15000.00'),
            amountPaid: new Prisma.Decimal('5000.00'),
            createdAt: new Date('2026-06-10T00:00:00.000Z'),
          },
          {
            totalAmount: new Prisma.Decimal('10000.00'),
            amountPaid: new Prisma.Decimal('0.00'),
            createdAt: new Date('2026-06-15T00:00:00.000Z'),
          },
        ],
        new Date('2026-06-20T00:00:00.000Z'),
      );

      expect(summary.totalOutstanding).toBe('20000.00');
      expect(summary.unpaidInvoiceCount).toBe(2);
      expect(summary.nextDueDate).not.toBeNull();
      expect(summary.currency).toBe('NGN');
    });

    it('returns zero state when no unpaid invoices', () => {
      const summary = buildBillingSummary([], now);
      expect(summary.totalOutstanding).toBe('0.00');
      expect(summary.unpaidInvoiceCount).toBe(0);
      expect(summary.nextDueDate).toBeNull();
      expect(summary.daysUntilDue).toBe(0);
    });
  });

  describe('payment helpers', () => {
    it('masks card references', () => {
      expect(
        maskPaymentReference('4111111111119012', InvoicePaymentMethod.CARD),
      ).toBe('**** 9012');
    });

    it('formats payment method labels', () => {
      expect(paymentMethodLabel(InvoicePaymentMethod.TRANSFER)).toBe(
        'Bank Transfer',
      );
    });

    it('builds method detail for card payments', () => {
      expect(
        paymentMethodDetail(
          InvoicePaymentMethod.CARD,
          '4111111111119012',
        ),
      ).toBe('Card ID: **** 9012');
    });
  });

  describe('toInvoiceSummaryDto', () => {
    it('maps list row with balance', () => {
      const dto = toInvoiceSummaryDto({
        id: 'inv-1',
        invoiceID: 'ISH-44021',
        status: InvoiceStatus.PENDING,
        totalAmount: new Prisma.Decimal('15000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        createdAt: new Date('2024-10-12T00:00:00.000Z'),
        encounter: null,
        invoiceItems: [baseItem],
      });

      expect(dto.invoiceNumber).toBe('ISH-44021');
      expect(dto.balance).toBe('15000.00');
      expect(dto.title).toBe('Consultation');
    });
  });

  describe('decimalBalance', () => {
    it('never returns negative balance', () => {
      expect(
        formatDecimalAmount(
          decimalBalance(
            new Prisma.Decimal('100.00'),
            new Prisma.Decimal('150.00'),
          ),
        ),
      ).toBe('0.00');
    });
  });
});
