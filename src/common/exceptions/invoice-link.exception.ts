import { HttpException, HttpStatus } from '@nestjs/common';

export type InvoiceLinkErrorCode =
  | 'INVOICE_NOT_PAID'
  | 'INVOICE_ITEM_NOT_FOUND'
  | 'INVOICE_ITEM_ALREADY_CONSUMED'
  | 'INVOICE_ITEM_CATEGORY_MISMATCH'
  | 'INVOICE_PATIENT_MISMATCH'
  | 'INVOICE_ITEM_SERVICE_MISMATCH'
  | 'INVALID_INVOICE_LINK_PAYLOAD';

export function invoiceLinkException(
  code: InvoiceLinkErrorCode,
  message: string,
): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      code,
      message,
    },
    HttpStatus.BAD_REQUEST,
  );
}
