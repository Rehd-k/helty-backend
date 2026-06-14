import { Prisma } from '@prisma/client';

export const EXTERNAL_REQUISITION_ITEM_SKU = 'EXTERNAL-REQ-LINE';

/** Placeholder catalog row for PO lines sourced from other departments (drug/consumable). */
export async function findOrCreateExternalRequisitionItem(
  tx: Prisma.TransactionClient,
  createdById: string,
) {
  const existing = await tx.purchaseItem.findFirst({
    where: { sku: EXTERNAL_REQUISITION_ITEM_SKU, deletedAt: null },
  });
  if (existing) return existing;
  return tx.purchaseItem.create({
    data: {
      itemName: 'External requisition line',
      sku: EXTERNAL_REQUISITION_ITEM_SKU,
      description: 'Placeholder for cross-department requisition PO lines',
      createdById,
      updatedById: createdById,
    },
  });
}

export function resolvePagination(query: {
  page?: number;
  pageSize?: number;
  skip?: number;
  limit?: number;
}) {
  const pageSize = Math.min(Math.max(1, query.pageSize ?? query.limit ?? 20), 100);
  const page = Math.max(1, query.page ?? 1);
  // skip must stay undefined when omitted (see PaginationDto) so page-based offset applies.
  const skip =
    query.skip !== undefined ? Math.max(0, query.skip) : (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}
