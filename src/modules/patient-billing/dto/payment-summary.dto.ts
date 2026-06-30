import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoicePaymentMethod } from '@prisma/client';

export class PaymentHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  amount!: string;

  @ApiPropertyOptional({ enum: InvoicePaymentMethod, nullable: true })
  method?: InvoicePaymentMethod | null;

  @ApiProperty()
  methodLabel!: string;

  @ApiProperty()
  methodDetail!: string;

  @ApiProperty()
  paidAt!: Date;

  @ApiProperty({ example: 'SUCCESS' })
  status!: string;
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentHistoryItemDto] })
  data!: PaymentHistoryItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class ReceiptResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  paidAt!: Date;

  @ApiPropertyOptional({ enum: InvoicePaymentMethod, nullable: true })
  method?: InvoicePaymentMethod | null;

  @ApiProperty()
  methodLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  url?: string | null;
}
