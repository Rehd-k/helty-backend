import { MedicationAdminStatus, Prisma } from '@prisma/client';

export function parseQuantityFromDose(dose: string | null | undefined): number | null {
  if (!dose?.trim()) return null;
  const match = dose.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function resolveOrderedQuantity(order: {
  quantity: Prisma.Decimal | null;
  dose: string | null;
}): Prisma.Decimal | null {
  if (order.quantity != null) return order.quantity;
  const fromDose = parseQuantityFromDose(order.dose);
  return fromDose != null ? new Prisma.Decimal(fromDose) : null;
}

export function computeIsOverMedication(
  administered: Prisma.Decimal | null | undefined,
  ordered: Prisma.Decimal | null,
): boolean {
  if (administered == null || ordered == null) return false;
  return administered.gt(ordered);
}

export function toAdministrationQuantity(
  status: MedicationAdminStatus,
  quantity: number | undefined,
): Prisma.Decimal | null {
  if (status !== MedicationAdminStatus.GIVEN) return null;
  if (quantity === undefined || quantity === null) {
    return null;
  }
  return new Prisma.Decimal(quantity);
}
