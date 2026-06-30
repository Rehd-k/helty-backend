import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { PatientBillType } from '../patient-billing.constants';

export class InvoiceSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: PatientBillType })
  billType!: PatientBillType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  amountPaid!: string;

  @ApiProperty()
  balance!: string;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceSummaryDto] })
  data!: InvoiceSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
