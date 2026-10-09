import { LabOrderStatus, LabRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Marks a lab order completed after a result is saved. Verified orders stay verified. */
export async function markLabOrderCompletedOnResultSave(
  prisma: PrismaService,
  orderId: string,
): Promise<void> {
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    select: { status: true, invoiceItemId: true },
  });
  if (!order || order.status === LabOrderStatus.VERIFIED) return;

  await prisma.labOrder.update({
    where: { id: orderId },
    data: {
      status: LabOrderStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  if (!order.invoiceItemId) return;

  await prisma.labRequest.updateMany({
    where: {
      invoiceItemId: order.invoiceItemId,
      status: { not: LabRequestStatus.CANCELLED },
    },
    data: { status: LabRequestStatus.COMPLETED },
  });
}
