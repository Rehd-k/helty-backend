import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  InvoicePaymentSource,
  InvoiceStatus,
  TransactionPaymentMethod,
} from '@prisma/client';

// ─── Invoice DTOs ──────────────────────────────────────────────────────────────

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'UUID of the patient this invoice belongs to',
    example: 'a1b2c3d4-…',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({
    enum: InvoiceStatus,
    description: 'Initial status of the invoice',
    example: InvoiceStatus.PENDING,
  })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'UUID of a staff member to associate with this invoice',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the encounter this invoice is tied to (for medication orders, same encounter = same invoice)',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  encounterId?: string;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

// ─── InvoiceItem DTOs ──────────────────────────────────────────────────────────

export class AddInvoiceItemDto {
  @ApiProperty({
    description: 'UUID of the service to add as a line item',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiPropertyOptional({
    description: 'Quantity of the service rendered',
    example: 1,
    default: 1,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Unit price used for this line item',
    example: 3500,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Marks this item as recurring daily billing',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRecurringDaily?: boolean;

  @ApiPropertyOptional({
    description:
      'When isRecurringDaily is true: start of the first billing segment (ISO 8601). Defaults to server time "now" if omitted.',
    example: '2026-03-27T08:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  recurringSegmentStartAt?: string;
}

export class UpdateInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Updated quantity', example: 2 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Updated unit price',
    example: 3200,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;
}

export class RecordInvoicePaymentDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: InvoicePaymentSource,
    example: InvoicePaymentSource.CASH,
  })
  @IsEnum(InvoicePaymentSource)
  source: InvoicePaymentSource;

  @ApiPropertyOptional({
    description: 'Reference for cash/transfer receipt or wallet usage context',
    example: 'cash-receipt-10023',
  })
  @IsOptional()
  @IsNotEmpty()
  reference?: string;
}

export class InvoiceItemAllocationDto {
  @ApiProperty({ description: 'InvoiceItem UUID on this invoice' })
  @IsUUID()
  @IsNotEmpty()
  invoiceItemId: string;

  @ApiProperty({
    description: 'Amount of this payment applied to the line',
    example: 1500,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class AllocateInvoiceItemPaymentDto {
  @ApiProperty({ description: 'Staff UUID receiving / recording the payment' })
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiPropertyOptional({
    description:
      'Existing billing Transaction UUID linked to this invoice; omit to use or create a default linked transaction',
  })
  @IsUUID()
  @IsOptional()
  billingTransactionId?: string;

  @ApiProperty({ description: 'Total payment amount (must equal sum of allocations)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: TransactionPaymentMethod })
  @IsEnum(TransactionPaymentMethod)
  method: TransactionPaymentMethod;

  @ApiPropertyOptional({ description: 'Receipt / transfer reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Bank account number registered in the system (same as transaction record payment)',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({
    type: [InvoiceItemAllocationDto],
    description: 'How the payment is split across invoice lines',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemAllocationDto)
  allocations: InvoiceItemAllocationDto[];
}

export class WalletDepositDto {
  @ApiProperty({ example: 10000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Deposit reference',
    example: 'deposit',
  })
  @IsOptional()
  @IsNotEmpty()
  reference?: string;
}
