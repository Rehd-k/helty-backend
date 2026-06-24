import { RadiologyRequestStatus } from '@prisma/client';
import { deriveRadiologyOrderStatusFromItems } from './radiology-order-status.util';

describe('deriveRadiologyOrderStatusFromItems', () => {
  it('returns PENDING for empty list', () => {
    expect(deriveRadiologyOrderStatusFromItems([])).toBe(
      RadiologyRequestStatus.PENDING,
    );
  });

  it('returns CANCELLED when all items are cancelled', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([
        RadiologyRequestStatus.CANCELLED,
        RadiologyRequestStatus.CANCELLED,
      ]),
    ).toBe(RadiologyRequestStatus.CANCELLED);
  });

  it('returns IN_PROGRESS when any item is in progress', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([
        RadiologyRequestStatus.COMPLETED,
        RadiologyRequestStatus.IN_PROGRESS,
      ]),
    ).toBe(RadiologyRequestStatus.IN_PROGRESS);
  });

  it('returns REPORTED when all non-cancelled items are terminal and one is reported', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([
        RadiologyRequestStatus.REPORTED,
        RadiologyRequestStatus.COMPLETED,
      ]),
    ).toBe(RadiologyRequestStatus.REPORTED);
  });

  it('returns COMPLETED when all non-cancelled items are completed', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([
        RadiologyRequestStatus.COMPLETED,
        RadiologyRequestStatus.CANCELLED,
      ]),
    ).toBe(RadiologyRequestStatus.COMPLETED);
  });

  it('returns SCHEDULED when any item is scheduled and none in progress', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([
        RadiologyRequestStatus.SCHEDULED,
        RadiologyRequestStatus.PENDING,
      ]),
    ).toBe(RadiologyRequestStatus.SCHEDULED);
  });

  it('returns PENDING when items are only pending', () => {
    expect(
      deriveRadiologyOrderStatusFromItems([RadiologyRequestStatus.PENDING]),
    ).toBe(RadiologyRequestStatus.PENDING);
  });
});
