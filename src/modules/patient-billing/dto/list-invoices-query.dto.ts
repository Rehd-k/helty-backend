import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const INVOICE_STATUS_FILTER = [
  ...Object.values(InvoiceStatus),
  'UNPAID',
] as const;

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: INVOICE_STATUS_FILTER,
    description: 'UNPAID is an alias for status != PAID',
  })
  @IsOptional()
  @IsIn(INVOICE_STATUS_FILTER)
  status?: InvoiceStatus | 'UNPAID';
}
