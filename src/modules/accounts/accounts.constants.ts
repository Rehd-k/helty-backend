/** Route guard tokens for accounting department staff. */
export const ACCOUNTING_ACCESS = [
  'ACCOUNTING',
  'ACCOUNTS',
  'SUPER_ADMIN',
] as const;

/** Account head only (plus super admin). */
export const ACCOUNT_HEAD_ACCESS = ['ACCOUNT_HEAD', 'SUPER_ADMIN'] as const;

/** Invoice line refund review (account head or billing head). */
export const REFUND_REVIEW_ACCESS = [
  ...ACCOUNT_HEAD_ACCESS,
  'BILLING_HEAD',
] as const;

export const FINANCE_AUDIT_ENTITIES = [
  'invoice',
  'payment',
  'receivable',
  'remittance',
  'wallet',
] as const;

export const INVOICE_CHANGE_ACTIONS = [
  'ITEM_ADDED',
  'ITEM_UPDATED',
  'ITEM_REMOVED',
  'DRUG_RETURNED',
  'PURCHASE_ITEM_RETURNED',
] as const;
