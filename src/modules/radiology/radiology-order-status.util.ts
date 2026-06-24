import { Prisma, RadiologyRequestStatus } from '@prisma/client';

export function deriveRadiologyOrderStatusFromItems(
  statuses: RadiologyRequestStatus[],
): RadiologyRequestStatus {
  if (statuses.length === 0) {
    return RadiologyRequestStatus.PENDING;
  }

  if (statuses.every((s) => s === RadiologyRequestStatus.CANCELLED)) {
    return RadiologyRequestStatus.CANCELLED;
  }

  const nonCancelled = statuses.filter(
    (s) => s !== RadiologyRequestStatus.CANCELLED,
  );

  if (nonCancelled.some((s) => s === RadiologyRequestStatus.IN_PROGRESS)) {
    return RadiologyRequestStatus.IN_PROGRESS;
  }

  const allTerminal = nonCancelled.every(
    (s) =>
      s === RadiologyRequestStatus.COMPLETED ||
      s === RadiologyRequestStatus.REPORTED,
  );
  if (allTerminal) {
    if (nonCancelled.some((s) => s === RadiologyRequestStatus.REPORTED)) {
      return RadiologyRequestStatus.REPORTED;
    }
    return RadiologyRequestStatus.COMPLETED;
  }

  if (nonCancelled.some((s) => s === RadiologyRequestStatus.SCHEDULED)) {
    return RadiologyRequestStatus.SCHEDULED;
  }

  return RadiologyRequestStatus.PENDING;
}

export async function syncRadiologyOrderStatusAfterItemChange(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const items = await tx.radiologyOrderItem.findMany({
    where: { orderId },
    select: { status: true },
  });
  if (items.length === 0) {
    return;
  }

  const orderStatus = deriveRadiologyOrderStatusFromItems(
    items.map((i) => i.status),
  );

  await tx.radiologyOrder.update({
    where: { id: orderId },
    data: { status: orderStatus },
  });
}
