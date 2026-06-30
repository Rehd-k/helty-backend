import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BillingSummaryResponseDto {
  @ApiProperty({ example: '124500.00' })
  totalOutstanding!: string;

  @ApiProperty({ example: 2 })
  unpaidInvoiceCount!: number;

  @ApiPropertyOptional({ nullable: true })
  nextDueDate?: Date | null;

  @ApiProperty({ example: 3 })
  daysUntilDue!: number;

  @ApiProperty({ example: 'NGN' })
  currency!: string;
}
