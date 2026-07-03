import {
  InvoiceCoverageKind,
  InvoiceCoverageScope,
  InvoiceCoverageStatus,
  InvoicePaymentSource,
  Prisma,
} from '@prisma/client';

export type PharmacyPayerType = 'Cash' | 'Insurance' | 'Corporate' | 'HMO';

type Tx = Prisma.TransactionClient;

/**
 * Derive pharmacy payer label at dispense time (stable snapshot for reporting).
 */
export async function resolvePharmacyPayerType(
  tx: Tx,
  invoiceId: string,
  invoiceItemId: string,
): Promise<PharmacyPayerType> {
  const [coverages, payments, claimCount, invoice] = await Promise.all([
    tx.invoiceCoverage.findMany({
      where: {
        status: { not: InvoiceCoverageStatus.REVERSED },
        OR: [
          { invoiceId, scope: InvoiceCoverageScope.INVOICE },
          { invoiceItemId, scope: InvoiceCoverageScope.ITEM },
        ],
      },
      select: { kind: true },
    }),
    tx.invoicePayment.findMany({
      where: { invoiceId },
      select: { source: true },
    }),
    tx.insuranceClaim.count({ where: { invoiceId } }),
    tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { patient: { select: { hmoId: true } } },
    }),
  ]);

  if (coverages.some((c) => c.kind === InvoiceCoverageKind.HMO)) {
    return 'HMO';
  }
  if (invoice?.patient?.hmoId) {
    return 'HMO';
  }
  if (
    payments.some((p) => p.source === InvoicePaymentSource.INSURANCE) ||
    claimCount > 0
  ) {
    return 'Insurance';
  }
  if (coverages.some((c) => c.kind === InvoiceCoverageKind.DISCOUNT)) {
    return 'Corporate';
  }
  return 'Cash';
}
