import { InvoiceStatus, Prisma } from '@prisma/client';

/** Payments that still count in live totals and department work. */
export function liveInvoicePaymentFilter(
  extraInvoice?: Prisma.InvoiceWhereInput,
): Prisma.InvoicePaymentWhereInput {
  return {
    invoice: {
      ...extraInvoice,
      status: { not: InvoiceStatus.DELETED },
    },
  };
}

/** Hide work that belongs to a soft-deleted invoice. Unlinked rows stay visible. */
export const notOnDeletedInvoice = {
  NOT: { invoice: { status: InvoiceStatus.DELETED } },
} as const;
