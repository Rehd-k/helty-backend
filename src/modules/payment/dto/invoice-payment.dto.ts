import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RecordInvoicePaymentDto } from '../../invoice/dto/invoice.dto';

/**
 * POST /invoices/payments — same fields as recording on an invoice, plus `invoiceId`.
 */
export class CreateInvoicePaymentBodyDto extends RecordInvoicePaymentDto {
  @ApiProperty({ description: 'Target invoice UUID' })
  @IsUUID()
  invoiceId!: string;
}

/**
 * PATCH /invoices/payments/:id — metadata only. Does not change amount, source,
 * method, or invoice linkage (use void + re-record for monetary corrections).
 */
export class UpdateInvoicePaymentDto {
  @ApiPropertyOptional({ description: 'Receipt / transfer reference' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reference?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'When the payment was received (ISO-8601)',
    example: '2026-04-17T12:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Staff UUID who received the payment' })
  @IsOptional()
  @IsUUID()
  receivedById?: string | null;

  @ApiPropertyOptional({
    description: 'Registered bank UUID, or null to clear',
  })
  @IsOptional()
  @IsUUID()
  bankId?: string | null;
}

export class VoidInvoicePaymentQueryDto {
  @ApiPropertyOptional({
    description: 'Optional reason stored on the invoice audit log',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
