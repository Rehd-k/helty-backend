import { MedicationAdminStatus, Prisma } from '@prisma/client';
import {
  computeIsOverMedication,
  parseQuantityFromDose,
  resolveOrderedQuantity,
} from './medication-administration.utils';

describe('medication-administration.utils', () => {
  it('parseQuantityFromDose reads leading number', () => {
    expect(parseQuantityFromDose('2 tablets')).toBe(2);
    expect(parseQuantityFromDose('500mg')).toBe(500);
    expect(parseQuantityFromDose('')).toBeNull();
  });

  it('resolveOrderedQuantity prefers order.quantity', () => {
    expect(
      resolveOrderedQuantity({
        quantity: new Prisma.Decimal(2),
        dose: '5 tablets',
      })!.toString(),
    ).toBe('2');
    expect(
      resolveOrderedQuantity({ quantity: null, dose: '3 tabs' })!.toString(),
    ).toBe('3');
  });

  it('computeIsOverMedication when administered exceeds ordered', () => {
    expect(
      computeIsOverMedication(new Prisma.Decimal(3), new Prisma.Decimal(2)),
    ).toBe(true);
    expect(
      computeIsOverMedication(new Prisma.Decimal(2), new Prisma.Decimal(2)),
    ).toBe(false);
    expect(
      computeIsOverMedication(null, new Prisma.Decimal(2)),
    ).toBe(false);
  });
});
