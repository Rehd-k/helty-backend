import { Prisma } from '@prisma/client';

export type LabCatalogCascadeDeleteSummary = {
  deletedResults: number;
  deletedOrderItems: number;
  deletedTests: number;
  deletedEmptyOrders: number;
};

const emptySummary = (): LabCatalogCascadeDeleteSummary => ({
  deletedResults: 0,
  deletedOrderItems: 0,
  deletedTests: 0,
  deletedEmptyOrders: 0,
});

/**
 * Removes lab tests and all dependent configuration and operational data:
 * results, samples (via order item delete), order line items, then tests
 * (versions and fields cascade from test delete). Empty lab orders are removed.
 */
export async function cascadeDeleteLabTests(
  tx: Prisma.TransactionClient,
  testIds: string[],
): Promise<LabCatalogCascadeDeleteSummary> {
  if (testIds.length === 0) return emptySummary();

  const versions = await tx.labTestVersion.findMany({
    where: { testId: { in: testIds } },
    select: { id: true },
  });
  const versionIds = versions.map((v) => v.id);

  if (versionIds.length === 0) {
    const deletedTests = await tx.labTest.deleteMany({
      where: { id: { in: testIds } },
    });
    return { ...emptySummary(), deletedTests: deletedTests.count };
  }

  const [fields, orderItems] = await Promise.all([
    tx.labTestField.findMany({
      where: { testVersionId: { in: versionIds } },
      select: { id: true },
    }),
    tx.labOrderItem.findMany({
      where: { testVersionId: { in: versionIds } },
      select: { id: true, orderId: true },
    }),
  ]);

  const fieldIds = fields.map((f) => f.id);
  const orderItemIds = orderItems.map((oi) => oi.id);
  const affectedOrderIds = [...new Set(orderItems.map((oi) => oi.orderId))];

  const resultOr: Prisma.LabResultWhereInput[] = [];
  if (fieldIds.length > 0) resultOr.push({ fieldId: { in: fieldIds } });
  if (orderItemIds.length > 0) resultOr.push({ orderItemId: { in: orderItemIds } });

  let deletedResults = 0;
  if (resultOr.length > 0) {
    const result = await tx.labResult.deleteMany({ where: { OR: resultOr } });
    deletedResults = result.count;
  }

  let deletedOrderItems = 0;
  if (orderItemIds.length > 0) {
    const deleted = await tx.labOrderItem.deleteMany({
      where: { id: { in: orderItemIds } },
    });
    deletedOrderItems = deleted.count;
  }

  let deletedEmptyOrders = 0;
  if (affectedOrderIds.length > 0) {
    const emptyOrders = await tx.labOrder.findMany({
      where: {
        id: { in: affectedOrderIds },
        items: { none: {} },
      },
      select: { id: true },
    });
    if (emptyOrders.length > 0) {
      const deleted = await tx.labOrder.deleteMany({
        where: { id: { in: emptyOrders.map((o) => o.id) } },
      });
      deletedEmptyOrders = deleted.count;
    }
  }

  const deletedTests = await tx.labTest.deleteMany({
    where: { id: { in: testIds } },
  });

  return {
    deletedResults,
    deletedOrderItems,
    deletedTests: deletedTests.count,
    deletedEmptyOrders,
  };
}
